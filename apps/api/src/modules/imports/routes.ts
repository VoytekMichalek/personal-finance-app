import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  previewSchema,
  commitImportSchema,
  mappingSchema,
  csvHeadersSchema,
  categorise,
  applyTransferRules,
  type Category,
  today,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "../finance/service.js";
import { csvRecords, parseRows, readCsv } from "./parser.js";
import { suggestCsv } from "./suggestions.js";
import { commitRows } from "./commit.js";
import { suggestMapping } from "./mapping.js";
import { reconcileCsv } from "./balances.js";
export const importRouter = Router();
importRouter.get("/mapping/:accountId", async (req, res) => {
  const saved = await prisma.importMapping.findUnique({
    where: { accountId: z.uuid().parse(req.params.accountId) },
  });
  res.json(saved?.mapping ?? null);
});
importRouter.post("/headers", async (req, res) => {
  const input = csvHeadersSchema.parse(req.body);
  if (input.accountId) await validateAccount(prisma, input.accountId);
  const { rows, hasHeaders } = readCsv(input.csv, input.hasHeaders);
  const saved = input.accountId
    ? await prisma.importMapping.findUnique({
        where: { accountId: input.accountId },
      })
    : null;
  res.json({
    headers: Object.keys(rows[0] ?? {}),
    sample: rows.slice(0, 4),
    rowCount: rows.length,
    hasHeaders,
    mapping: suggestMapping(rows, saved?.mapping),
  });
});
importRouter.post("/suggest", async (req, res) => {
  res.json(await suggestCsv(req.body));
});
importRouter.post("/preview", async (req, res) => {
  const input = previewSchema.parse(req.body);
  const account = await validateAccount(prisma, input.accountId);
  const records = csvRecords(input.csv, input.hasHeaders);
  const rows = parseRows(records, input.mapping, account.owner);
  const reconciliation = reconcileCsv(records, rows, input.mapping);
  const [existing, categories, rules, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId: account.id },
      select: {
        date: true,
        description: true,
        amountCents: true,
        categoryId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany(),
    prisma.rule.findMany(),
    prisma.account.findMany(),
  ]);
  applyTransferRules(rows, json(rules), account.id, accounts);
  categorise(rows, json<Category[]>(categories), json(rules), existing);
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
  res.json({
    id: batch.id,
    rows,
    filename: "CSV import",
    reconciliation,
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
      const mapping = mappingSchema.parse(batch.mapping);
      await tx.importMapping.upsert({
        where: { accountId: batch.accountId },
        create: { accountId: batch.accountId, mapping },
        update: { mapping },
      });
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
