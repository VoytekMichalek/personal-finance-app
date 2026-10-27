import { accountBalance } from "./finance.js";
import { addDays } from "./money.js";
import type { Account, Transaction } from "./types.js";

/** Opening is before the first selected day's activity; points are daily closing balances. */
export function accountHistory(
  account: Account,
  transactions: Transaction[],
  from: string,
  to: string,
) {
  const start = from < account.openingDate ? account.openingDate : from;
  if (start > to)
    return {
      from: start,
      openingCents: 0,
      closingCents: 0,
      moneyInCents: 0,
      moneyOutCents: 0,
      netCents: 0,
      points: [],
    };
  const openingCents =
    start === account.openingDate
      ? account.openingBalanceCents
      : accountBalance(account, transactions, addDays(start, -1));
  const rows = transactions.filter(
    (row) =>
      row.accountId === account.id && row.date >= start && row.date <= to,
  );
  const daily = new Map<string, number>();
  let moneyInCents = 0,
    moneyOutCents = 0;
  for (const row of rows) {
    daily.set(row.date, (daily.get(row.date) ?? 0) + row.amountCents);
    if (row.amountCents > 0) moneyInCents += row.amountCents;
    else moneyOutCents -= row.amountCents;
  }
  let closingCents = openingCents;
  const points: { date: string; balanceCents: number }[] = [];
  for (let date = start; date <= to; date = addDays(date, 1)) {
    closingCents += daily.get(date) ?? 0;
    points.push({ date, balanceCents: closingCents });
  }
  return {
    from: start,
    openingCents,
    closingCents,
    moneyInCents,
    moneyOutCents,
    netCents: moneyInCents - moneyOutCents,
    points,
  };
}
