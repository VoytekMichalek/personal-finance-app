import type { Prisma, Transaction } from "@prisma/client";
import type {
  ImportConflict,
  ImportConflictMatch,
  commitImportSchema,
} from "@finance/shared";
import type { z } from "zod";
import { json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";

export type ApprovedImportRow = z.infer<
  typeof commitImportSchema
>["rows"][number];

export function conflictMatch(row: Transaction): ImportConflictMatch {
  return json<ImportConflictMatch>({
    id: row.id,
    version: row.version,
    accountId: row.accountId,
    date: row.date,
    amountCents: row.amountCents,
    description: row.description,
    transferGroupId: row.transferGroupId,
    kind: row.kind,
    scheduleId: row.scheduleId,
    occurrenceDate: row.occurrenceDate,
  });
}

export function importConflictError(conflicts: ImportConflict[]) {
  return new HttpError(
    409,
    "Review the matching payments highlighted above before importing.",
    { type: "import-conflicts", conflicts },
  );
}

export function canLinkPayment(row: ApprovedImportRow, target: Transaction) {
  return (
    row.kind === "transfer" &&
    row.linkExisting?.id === target.id &&
    row.linkExisting.version === target.version &&
    row.counterAccountId === target.accountId &&
    row.date === target.date &&
    BigInt(-row.amountCents) === target.amountCents &&
    ["income", "expense", "refund"].includes(target.kind) &&
    target.transferGroupId === null &&
    target.scheduleId === null &&
    target.occurrenceDate === null
  );
}

export async function checkImportConflicts(
  tx: Prisma.TransactionClient,
  batch: { id: string; accountId: string },
  rows: ApprovedImportRow[],
) {
  const accountIds = new Set([batch.accountId]);
  const linkIds = new Set<string>();
  const repeatedLinks = new Set<string>();
  for (const row of rows) {
    if (row.kind === "transfer" && row.counterAccountId)
      accountIds.add(row.counterAccountId);
    if (row.linkExisting) {
      if (linkIds.has(row.linkExisting.id))
        repeatedLinks.add(row.linkExisting.id);
      linkIds.add(row.linkExisting.id);
    }
  }
  const dates = rows.map((row) => row.date).sort();
  const existing = await tx.transaction.findMany({
    where: {
      OR: [
        {
          accountId: { in: [...accountIds] },
          date: { gte: dates[0], lte: dates.at(-1) },
        },
        ...(linkIds.size ? [{ id: { in: [...linkIds] } }] : []),
      ],
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const byId = new Map(existing.map((row) => [row.id, row]));
  const bySignature = new Map<string, Transaction[]>();
  for (const row of existing) {
    const key = `${row.accountId}|${row.date}|${row.amountCents}`;
    const group = bySignature.get(key) ?? [];
    group.push(row);
    bySignature.set(key, group);
  }
  const conflicts: ImportConflict[] = [];
  for (const row of rows) {
    const duplicates = (
      bySignature.get(`${batch.accountId}|${row.date}|${row.amountCents}`) ?? []
    ).filter((record) => record.importBatchId !== batch.id);
    if (duplicates.length && !row.allowDuplicate)
      conflicts.push({
        rowNumber: row.rowNumber,
        reason: "duplicate",
        matches: duplicates.map(conflictMatch),
      });
    if (row.linkExisting) {
      const target = byId.get(row.linkExisting.id);
      if (
        !target ||
        repeatedLinks.has(row.linkExisting.id) ||
        !canLinkPayment(row, target)
      )
        conflicts.push({
          rowNumber: row.rowNumber,
          reason: "stale-link",
          matches: target ? [conflictMatch(target)] : [],
        });
    } else if (row.kind === "transfer") {
      const matches =
        bySignature.get(
          `${row.counterAccountId}|${row.date}|${-row.amountCents}`,
        ) ?? [];
      if (matches.length && !row.allowDuplicate)
        conflicts.push({
          rowNumber: row.rowNumber,
          reason: "counterpart",
          matches: matches.map(conflictMatch),
        });
    }
  }
  if (conflicts.length) throw importConflictError(conflicts);
}
