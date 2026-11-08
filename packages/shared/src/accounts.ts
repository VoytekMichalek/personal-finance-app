import type { Account, Transaction } from "./types.js";

/** Ledger dates, independent of upload order, opening balances and schedules. */
export function latestTransactionDates(
  transactions: Pick<Transaction, "accountId" | "date">[],
) {
  const dates = new Map<string, string>();
  for (const transaction of transactions) {
    if (transaction.date > (dates.get(transaction.accountId) ?? ""))
      dates.set(transaction.accountId, transaction.date);
  }
  return dates;
}

/** Assets and long-term debts contribute to net worth, not available cash. */
export const isCashAccount = (
  account: Account,
): account is Account & { type: "bank" | "cash" | "credit" } =>
  account.type !== "asset" && account.type !== "liability";

export const accountLabel = (account: Account) =>
  isCashAccount(account)
    ? account.name
    : `${account.name} · ${account.type === "asset" ? "Asset" : "Liability"}`;
