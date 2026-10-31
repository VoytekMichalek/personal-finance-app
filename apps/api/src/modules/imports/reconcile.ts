import { Prisma } from "@prisma/client";
import {
  importReconciliations,
  sameReconciliation,
  type Transaction,
  type ImportRow,
} from "@finance/shared";
import { json } from "../../lib/db.js";
import { importConflictError, type ApprovedImportRow } from "./conflicts.js";
import { validateAccount } from "../finance/service.js";

export async function reconcileImports(
  tx: Prisma.TransactionClient,
  batch: { id: string; accountId: string; preview: unknown },
  rows: ApprovedImportRow[],
) {
  const choices = rows.filter((row) => row.reconcileExisting);
  if (!choices.length) return;
  await validateAccount(tx, batch.accountId);
  const ids = [
    ...new Set(
      choices.flatMap((row) => [
        row.reconcileExisting!.id,
        row.reconcileExisting!.counterpartId,
      ]),
    ),
  ].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Transaction" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
  );
  const dates = choices.map((row) => row.date).sort();
  // Include complete groups to reject broken/changed pairs, not just the submitted IDs.
  const targets = await tx.transaction.findMany({ where: { id: { in: ids } } });
  const groups = targets.flatMap((row) =>
    row.transferGroupId ? [row.transferGroupId] : [],
  );
  const records = json<Transaction[]>(
    await tx.transaction.findMany({
      where: {
        OR: [
          {
            accountId: batch.accountId,
            date: { gte: dates[0], lte: dates.at(-1) },
          },
          { transferGroupId: { in: groups } },
        ],
      },
    }),
  );
  // Retain excluded source rows when testing ambiguity: selecting one cannot hide a duplicate.
  const approved = new Map(rows.map((row) => [row.rowNumber, row]));
  const sources = json<ImportRow[]>(batch.preview)
    .filter((row) => !row.error)
    .map((row) => approved.get(row.rowNumber) ?? row);
  const candidates = importReconciliations(batch.accountId, sources, records);
  const used = new Set<string>();
  const conflicts = choices.flatMap((row) => {
    const selected = row.reconcileExisting!;
    const candidate = candidates.find(
      (item) => item.rowNumber === row.rowNumber,
    );
    const valid =
      !used.has(selected.id) &&
      !row.linkExisting &&
      !row.allowDuplicate &&
      row.kind === "transfer" &&
      candidate?.counterpart.accountId === row.counterAccountId &&
      sameReconciliation(candidate?.choice, selected);
    used.add(selected.id);
    return valid
      ? []
      : [
          {
            rowNumber: row.rowNumber,
            reason: "stale-reconciliation" as const,
            matches: candidate ? [candidate.match] : [],
          },
        ];
  });
  if (conflicts.length) throw importConflictError(conflicts);
  for (const row of choices) {
    // Claim the previously generated side for this source; preserve all ledger values and the other side's provenance.
    const changed = await tx.transaction.updateMany({
      where: {
        id: row.reconcileExisting!.id,
        version: row.reconcileExisting!.version,
        importBatchId: null,
        sourceRow: null,
      },
      data: {
        importBatchId: batch.id,
        sourceRow: row.rowNumber,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw importConflictError([
        {
          rowNumber: row.rowNumber,
          reason: "stale-reconciliation",
          matches: [],
        },
      ]);
  }
}
