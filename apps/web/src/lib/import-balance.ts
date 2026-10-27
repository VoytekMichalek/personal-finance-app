import {
  accountBalance,
  type ImportPreview,
  type Snapshot,
} from "@finance/shared";
export function importBalance(
  data: Snapshot,
  accountId: string,
  preview: ImportPreview,
) {
  const account = data.accounts.find((item) => item.id === accountId)!;
  const source = preview.reconciliation;
  const end = source?.to ?? data.today;
  const selected = preview.rows.filter((row) => row.include && !row.error);
  const projected =
    accountBalance(account, data.transactions, end) +
    selected
      .filter((row) => row.date <= end)
      .reduce((sum, row) => sum + row.amountCents, 0);
  const difference =
    source?.balanceVerified && source.bankClosingCents !== null
      ? projected - source.bankClosingCents
      : null;
  return { source, selected, projected, difference, account, end };
}
