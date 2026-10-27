import {
  parseMoney,
  type ImportRow,
  type Mapping,
  type CsvReconciliation,
} from "@finance/shared";

export function runningBalances(
  rows: { date: string; amountCents: number }[],
  balances: number[],
) {
  if (!rows.length || rows.length !== balances.length) return null;
  for (const reverse of [false, true]) {
    const ordered = rows.map((row, index) => ({
      ...row,
      balance: balances[index]!,
    }));
    if (reverse) ordered.reverse();
    if (
      ordered.some(
        (row, index) =>
          index > 0 &&
          (row.date < ordered[index - 1]!.date ||
            row.balance !== ordered[index - 1]!.balance + row.amountCents),
      )
    )
      continue;
    return {
      from: ordered[0]!.date,
      to: ordered.at(-1)!.date,
      bankOpeningCents: ordered[0]!.balance - ordered[0]!.amountCents,
      bankClosingCents: ordered.at(-1)!.balance,
    };
  }
  return null;
}

export function reconcileCsv(
  records: Record<string, string>[],
  rows: ImportRow[],
  mapping: Mapping,
): CsvReconciliation {
  const dates = rows
    .filter((row) => row.date)
    .map((row) => row.date)
    .sort();
  const result: CsvReconciliation = {
    sourceRows: records.length,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    netCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    bankOpeningCents: null,
    bankClosingCents: null,
    balanceVerified: false,
    warning: null,
  };
  if (!mapping.balanceColumn) return result;
  try {
    const balances = records.map((record) =>
      parseMoney(record[mapping.balanceColumn!] ?? ""),
    );
    const checked = rows.every((row) => !row.error)
      ? runningBalances(rows, balances)
      : null;
    if (checked) return { ...result, ...checked, balanceVerified: true };
    result.warning =
      "The running balances do not reconcile with every source row. Check the amount, date and balance columns, row order, and any missing transactions.";
  } catch {
    result.warning =
      "Some running balances could not be read. Check the balance column before comparing totals.";
  }
  return result;
}
