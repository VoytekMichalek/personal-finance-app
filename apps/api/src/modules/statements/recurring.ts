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
import { validateAccount } from "../finance/service.js";
import { validateSchedule } from "../finance/schedules.js";
import { recurringMerchant, recurringSuggestions } from "./suggestions.js";
export async function saveSuggestions(
  tx: Prisma.TransactionClient,
  accountId: string,
  rows: (Pick<ImportRow, "rowNumber" | "include" | "amountCents"> &
    Partial<Pick<ImportRow, "kind">>)[],
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
    const incoming =
      suggestion.schedule.kind === "income" ||
      (suggestion.schedule.kind === "transfer" &&
        suggestion.schedule.counterAccountId === accountId);
    if (
      suggestion.evidence.filter((n) =>
        rows.some(
          (r) =>
            r.rowNumber === n &&
            r.include &&
            r.kind !== "refund" &&
            r.amountCents > 0 === incoming,
        ),
      ).length < 2
    )
      throw new HttpError(
        400,
        "A recurring suggestion needs at least two accepted matching transactions.",
      );
    const schedule = accepted.schedule;
    const matchesAccount =
      schedule.kind === "transfer" && incoming
        ? schedule.counterAccountId === accountId
        : schedule.accountId === accountId;
    if (!matchesAccount || schedule.startDate <= today())
      throw new HttpError(
        400,
        "Recurring items must start in the future on this account.",
      );
    await validateSchedule(tx, schedule);
    if (
      await tx.schedule.findFirst({
        where: {
          OR: [
            { accountId },
            { kind: "transfer", counterAccountId: accountId },
          ],
          name: { equals: schedule.name, mode: "insensitive" },
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
  const groups = entries.flatMap((row) =>
    row.transferGroupId ? [row.transferGroupId] : [],
  );
  const peers = groups.length
    ? await db.transaction.findMany({
        where: { transferGroupId: { in: groups } },
      })
    : [];
  for (const row of rows.filter((row) => row.kind === "transfer")) {
    const source = entries.find((entry) => entry.sourceRow === row.rowNumber)!;
    const pair = peers.filter(
      (peer) => peer.transferGroupId === source.transferGroupId,
    );
    const other = pair.find((peer) => peer.id !== source.id);
    if (
      pair.length === 2 &&
      other?.kind === "transfer" &&
      other.accountId !== source.accountId &&
      other.amountCents === -source.amountCents &&
      other.date === source.date
    )
      row.counterAccountId = other.accountId;
  }
  const existing = await db.schedule.findMany({
    where: {
      OR: [
        { accountId: statement.accountId },
        { kind: "transfer", counterAccountId: statement.accountId },
      ],
      cancelled: false,
    },
  });
  const suggestions = recurringSuggestions(
    rows,
    statement.accountId,
    today(),
  ).filter(
    (candidate) =>
      !existing.some(
        (schedule) =>
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
