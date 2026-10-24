import {
  statementRecurringSchema,
  today,
  type ImportRow,
  type RecurringSuggestion,
} from "@finance/shared";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma, json, type DB } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import {
  validateAccount,
  validateCategory,
  validateOwner,
} from "../finance/service.js";
import { recurringMerchant, recurringSuggestions } from "./suggestions.js";
export async function saveSuggestions(
  tx: Prisma.TransactionClient,
  accountId: string,
  rows: (Pick<ImportRow, "rowNumber" | "include"> & {
    kind?: ImportRow["kind"];
  })[],
  suggestions: RecurringSuggestion[],
  choices: z.output<typeof statementRecurringSchema>["schedules"],
) {
  const keys = new Set<string>();
  for (const accepted of choices) {
    const suggestion = suggestions.find((r) => r.key === accepted.key);
    if (!suggestion || keys.has(accepted.key))
      throw new HttpError(
        400,
        "Choose each recurring suggestion at most once.",
      );
    keys.add(accepted.key);
    if (
      suggestion.evidence.filter((n) =>
        rows.some(
          (r) =>
            r.rowNumber === n && r.include && r.kind === accepted.schedule.kind,
        ),
      ).length < 2
    )
      throw new HttpError(
        400,
        "A recurring suggestion needs at least two accepted matching transactions.",
      );
    const schedule = accepted.schedule;
    if (schedule.accountId !== accountId || schedule.startDate <= today())
      throw new HttpError(
        400,
        "Recurring items must start in the future on this account.",
      );
    await validateOwner(tx, schedule.owner);
    await validateCategory(tx, schedule.categoryId, schedule.kind);
    if (
      await tx.schedule.findFirst({
        where: {
          accountId: accountId,
          name: { equals: schedule.name, mode: "insensitive" },
          kind: schedule.kind,
          cancelled: false,
        },
      })
    )
      throw new HttpError(
        409,
        "A recurring item with this name already exists. Deselect the suggestion or rename it.",
      );
    await tx.schedule.create({
      data: { ...schedule, amountCents: BigInt(schedule.amountCents) },
    });
  }
}
async function savedEvidence(db: DB, id: string) {
  const statement = await db.statement.findUnique({
    where: { id },
    select: {
      accountId: true,
      importBatchId: true,
      importBatch: { select: { committedAt: true } },
    },
  });
  if (!statement) throw new HttpError(404, "Statement not found.");
  if (!statement.importBatch.committedAt)
    throw new HttpError(409, "Import the statement review first.");
  const entries = await db.transaction.findMany({
    where: {
      accountId: statement.accountId,
      importBatchId: statement.importBatchId,
      sourceRow: { not: null },
    },
  });
  const rows: ImportRow[] = json<typeof entries>(entries).map(
    (row: (typeof entries)[number]) => ({
      rowNumber: row.sourceRow!,
      date: row.date,
      description: row.description,
      amountCents: Number(row.amountCents),
      kind: row.kind as ImportRow["kind"],
      owner: row.owner,
      categoryId: row.categoryId,
      counterAccountId: null,
      include: true,
      allowDuplicate: false,
      duplicate: false,
      error: null,
    }),
  );
  const existing = await db.schedule.findMany({
    where: { accountId: statement.accountId, cancelled: false },
  });
  const suggestions = recurringSuggestions(
    rows,
    statement.accountId,
    today(),
  ).filter(
    (candidate) =>
      !existing.some(
        (schedule) =>
          schedule.kind === candidate.schedule.kind &&
          recurringMerchant(schedule.provider || schedule.name) ===
            recurringMerchant(
              candidate.schedule.provider || candidate.schedule.name,
            ),
      ),
  );
  return { accountId: statement.accountId, rows, suggestions };
}
export async function savedRecurring(id: string) {
  return (await savedEvidence(prisma, id)).suggestions;
}
export async function acceptSavedRecurring(id: string, body: unknown) {
  const input = statementRecurringSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    const statement = await tx.statement.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!statement) throw new HttpError(404, "Statement not found.");
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      statement.accountId,
    );
    await validateAccount(tx, statement.accountId);
    const evidence = await savedEvidence(tx, id);
    await saveSuggestions(
      tx,
      evidence.accountId,
      evidence.rows,
      evidence.suggestions,
      input.schedules,
    );
    return { saved: input.schedules.length };
  });
}
