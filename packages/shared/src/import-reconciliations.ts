import type { ImportRow, Transaction } from "./types.js";
import { transferCounterpart } from "./transaction-rules.js";

type Source = Pick<
  ImportRow,
  "rowNumber" | "date" | "amountCents" | "counterAccountId"
>;
export type ImportReconciliation = {
  rowNumber: number;
  match: Transaction;
  counterpart: Transaction;
  choice: NonNullable<ImportRow["reconcileExisting"]>;
};

/** Only one source row and one unclaimed, balanced transfer may share a signature. */
export function importReconciliations(
  accountId: string,
  rows: Source[],
  transactions: Transaction[],
): ImportReconciliation[] {
  const signature = (row: { date: string; amountCents: number }) =>
    `${row.date}|${row.amountCents}`;
  const counts = new Map<string, number>();
  const matches = new Map<string, Transaction[]>();
  for (const row of rows)
    counts.set(signature(row), (counts.get(signature(row)) ?? 0) + 1);
  for (const row of transactions.filter(
    (item) => item.accountId === accountId,
  )) {
    const key = signature(row);
    matches.set(key, [...(matches.get(key) ?? []), row]);
  }
  return rows.flatMap((row) => {
    const candidates = matches.get(signature(row)) ?? [];
    if (counts.get(signature(row)) !== 1 || candidates.length !== 1) return [];
    const match = candidates[0]!;
    if (match.importBatchId || match.sourceRow != null) return [];
    const counterpart = transferCounterpart(match, transactions);
    if (
      !counterpart ||
      (row.counterAccountId && row.counterAccountId !== counterpart.accountId)
    )
      return [];
    return [
      {
        rowNumber: row.rowNumber,
        match,
        counterpart,
        choice: {
          id: match.id,
          version: match.version,
          counterpartId: counterpart.id,
          counterpartVersion: counterpart.version,
        },
      },
    ];
  });
}

export function sameReconciliation(
  a: ImportRow["reconcileExisting"],
  b: ImportRow["reconcileExisting"],
): boolean {
  return (
    !!a &&
    !!b &&
    a.id === b.id &&
    a.version === b.version &&
    a.counterpartId === b.counterpartId &&
    a.counterpartVersion === b.counterpartVersion
  );
}
