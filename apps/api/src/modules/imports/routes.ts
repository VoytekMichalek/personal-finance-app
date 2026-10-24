import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  previewSchema,
  commitImportSchema,
  mappingSchema,
  today,
} from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { applyRule, validateAccount } from "../finance/service.js";
import { csvRecords, parseRows } from "./parser.js";
import { redact, suggest } from "../../integrations/openrouter.js";
import { commitRows } from "./commit.js";
export const importRouter = Router();
importRouter.get("/mapping/:accountId", async (req, res) => {
  const saved = await prisma.importMapping.findUnique({
    where: { accountId: z.uuid().parse(req.params.accountId) },
  });
  res.json(saved?.mapping ?? null);
});
importRouter.post("/headers", async (req, res) => {
  const csv = z.string().max(5_000_000).parse(req.body.csv);
  const rows = csvRecords(csv);
  res.json({
    headers: Object.keys(rows[0] ?? {}),
    sample: rows.slice(0, 4),
    rowCount: rows.length,
  });
});
importRouter.post("/suggest", async (req, res) => {
  const input = z
    .object({
      csv: z.string().max(5_000_000),
      rows: z
        .array(
          z.object({
            rowNumber: z.number().int(),
            description: z.string().max(250),
            amountCents: z.number(),
            kind: z
              .enum(["income", "expense", "refund", "transfer"])
              .optional(),
          }),
        )
        .max(500)
        .optional(),
    })
    .parse(req.body);
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  if (!modelId)
    throw new HttpError(400, "Choose a model in Settings → Imports first.");
  const records = csvRecords(input.csv);
  const categories = await prisma.category.findMany({
    where: { archived: false },
    select: { id: true, name: true, kind: true },
  });
  const result = await suggest(modelId, {
    headers: Object.keys(records[0] ?? {}),
    sample: records
      .slice(0, 3)
      .map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, redact(v)])),
      ),
    categories,
    rows: input.rows?.map((row) => ({
      rowNumber: row.rowNumber,
      description: redact(row.description),
      direction: row.kind
        ? row.kind === "income"
          ? "income"
          : "expense"
        : row.amountCents < 0
          ? "expense"
          : "income",
    })),
  });
  const headers = Object.keys(records[0] ?? {});
  if (
    result.mapping &&
    [
      result.mapping.dateColumn,
      result.mapping.descriptionColumn,
      result.mapping.amountColumn,
      result.mapping.debitColumn,
      result.mapping.creditColumn,
    ].some((c) => c && !headers.includes(c))
  )
    throw new HttpError(502, "AI suggested a column that is not in the CSV.");
  if (
    result.categories.some(
      (item) =>
        item.categoryId && !categories.some((c) => c.id === item.categoryId),
    )
  )
    throw new HttpError(502, "AI suggested an unknown category.");
  res.json(result);
});
importRouter.post("/preview", async (req, res) => {
  const input = previewSchema.parse(req.body);
  const account = await validateAccount(prisma, input.accountId);
  const records = csvRecords(input.csv);
  const rows = parseRows(records, input.mapping, account.owner);
  const existing = await prisma.transaction.findMany({
    where: { accountId: account.id },
    select: { date: true, description: true, amountCents: true },
  });
  const fingerprints = new Set(
    existing.map((t) => t.date + "|" + t.amountCents),
  );
  for (const row of rows) {
    if (row.error) continue;
    if (row.date < account.openingDate || row.date > today()) {
      row.error = "Date is outside the account’s posted history.";
      row.include = false;
      continue;
    }
    row.categoryId = await applyRule(
      prisma,
      row.description,
      row.amountCents > 0 ? "income" : "expense",
    );
    row.duplicate = fingerprints.has(row.date + "|" + row.amountCents);
    if (row.duplicate) row.include = false;
  }
  const fileHash = createHash("sha256").update(input.csv).digest("hex");
  const batch = await prisma.importBatch.create({
    data: {
      accountId: account.id,
      fileHash,
      mapping: input.mapping,
      preview: rows,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await prisma.importMapping.upsert({
    where: { accountId: account.id },
    create: { accountId: account.id, mapping: input.mapping },
    update: { mapping: input.mapping },
  });
  res.json({
    id: batch.id,
    rows,
    filename: "CSV import",
    validCount: rows.filter((r) => !r.error).length,
    invalidCount: rows.filter((r) => r.error).length,
  });
});
importRouter.post("/:id/commit", async (req, res) => {
  const batchId = z.uuid().parse(req.params.id);
  const input = commitImportSchema.parse(req.body);
  const result = await prisma.$transaction(
    async (tx) => {
      const initial = await tx.importBatch.findUnique({
        where: { id: batchId },
      });
      if (!initial) throw new HttpError(404, "Import preview not found.");
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        initial.accountId,
      );
      const batch = await tx.importBatch.findUniqueOrThrow({
        where: { id: batchId },
      });
      if (await tx.statement.findUnique({ where: { importBatchId: batch.id } }))
        throw new HttpError(400, "Confirm this PDF from the statement review.");
      const previous = await tx.importBatch.findFirst({
        where: {
          accountId: batch.accountId,
          fileHash: batch.fileHash,
          committedAt: { not: null },
        },
      });
      if (previous)
        return {
          id: previous.id,
          imported: await tx.transaction.count({
            where: { importBatchId: previous.id, sourceRow: { not: null } },
          }),
          alreadyImported: true,
        };
      if (batch.expiresAt <= new Date())
        throw new HttpError(409, "Preview expired. Upload the CSV again.");
      const imported = await commitRows(tx, batch, input);
      await tx.importBatch.update({
        where: { id: batch.id },
        data: { committedAt: new Date() },
      });
      return { id: batch.id, imported, alreadyImported: false };
    },
    { timeout: 60000 },
  );
  res.json(result);
});
importRouter.put("/mapping/:accountId", async (req, res) => {
  const mapping = mappingSchema.parse(req.body);
  const accountId = z.uuid().parse(req.params.accountId);
  await validateAccount(prisma, accountId);
  res.json(
    await prisma.importMapping.upsert({
      where: { accountId },
      create: { accountId, mapping },
      update: { mapping },
    }),
  );
});
