import type {
  Account,
  Asset,
  Budget,
  ForecastPoint,
  Occurrence,
  Schedule,
  Snapshot,
  Transaction,
} from "./types.js";
import { addDays, monthEnd } from "./money.js";
export function accountBalance(
  account: Account,
  transactions: Transaction[],
  date: string,
): number {
  if (date < account.openingDate) return 0;
  return (
    account.openingBalanceCents +
    transactions
      .filter(
        (t) =>
          t.accountId === account.id &&
          t.date <= date &&
          t.date >= account.openingDate,
      )
      .reduce((sum, t) => sum + t.amountCents, 0)
  );
}
export function categorySpend(
  transactions: Transaction[],
  categoryId: string,
  month: string,
  through = monthEnd(month),
): number {
  return -transactions
    .filter(
      (t) =>
        t.categoryId === categoryId &&
        t.kind !== "transfer" &&
        t.kind !== "income" &&
        t.date.startsWith(month) &&
        t.date <= through,
    )
    .reduce((sum, t) => sum + t.amountCents, 0);
}
export function effectiveBudgets(budgets: Budget[], month: string): Budget[] {
  const result = new Map<string, Budget>();
  for (const budget of [...budgets].sort((a, b) =>
    a.month.localeCompare(b.month),
  )) {
    if (budget.month <= month) result.set(budget.categoryId, budget);
  }
  return [...result.values()];
}
function monthlyOccurrence(start: string, months: number): string {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7)) - 1;
  const anchor = new Date(Date.UTC(year, month + months, 1));
  const days = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      Math.min(Number(start.slice(8)), days),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function scheduleDates(
  schedule: Schedule,
  from: string,
  to: string,
): string[] {
  if (schedule.cancelled) return [];
  const result: string[] = [];
  for (let n = 0; n < 20000; n++) {
    const date =
      schedule.frequency === "weekly"
        ? addDays(schedule.startDate, n * 7)
        : schedule.frequency === "fortnightly"
          ? addDays(schedule.startDate, n * 14)
          : monthlyOccurrence(
              schedule.startDate,
              n *
                (schedule.frequency === "quarterly"
                  ? 3
                  : schedule.frequency === "annually"
                    ? 12
                    : 1),
            );
    if (date > to || (schedule.endDate && date > schedule.endDate)) break;
    if (date >= from) result.push(date);
  }
  return result;
}
export function occurrences(
  schedules: Schedule[],
  transactions: Transaction[],
  from: string,
  to: string,
): Occurrence[] {
  const matches = new Set(
    transactions
      .filter((t) => t.scheduleId && t.occurrenceDate)
      .map((t) => t.scheduleId + "|" + t.occurrenceDate),
  );
  return schedules
    .flatMap((schedule) =>
      scheduleDates(schedule, from, to).map((date) => ({
        schedule,
        date,
        matched: matches.has(schedule.id + "|" + date),
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function forecast(snapshot: Snapshot, days = 90): ForecastPoint[] {
  const start = snapshot.today;
  const end = addDays(start, days);
  const planned = occurrences(
    snapshot.schedules,
    snapshot.transactions,
    start,
    end,
  ).filter((o) => !o.matched);
  // Bank/cash balances less credit owed: purchases reserve funds; repayments are transfers.
  let balance = snapshot.accounts.reduce(
    (sum, a) => sum + accountBalance(a, snapshot.transactions, start),
    0,
  );
  const points: ForecastPoint[] = [
    {
      date: start,
      balanceCents: balance,
      scheduledCents: 0,
      allowanceCents: 0,
    },
  ];
  const monthlyAllowance = new Map<
    string,
    { amount: number; days: number; start: string }
  >();
  for (
    let cursor = addDays(start, 1);
    cursor <= end;
    cursor = addDays(cursor, 1)
  ) {
    const month = cursor.slice(0, 7);
    if (!monthlyAllowance.has(month)) {
      const first =
        month === start.slice(0, 7) ? addDays(start, 1) : month + "-01";
      const last = monthEnd(month);
      const future = occurrences(
        snapshot.schedules,
        snapshot.transactions,
        month === start.slice(0, 7) ? start : first,
        last,
      ).filter((o) => !o.matched);
      const residual = effectiveBudgets(snapshot.budgets, month).reduce(
        (sum, b) => {
          const actual = categorySpend(
            snapshot.transactions,
            b.categoryId,
            month,
            start,
          );
          const scheduled = future
            .filter(
              (o) =>
                o.schedule.categoryId === b.categoryId &&
                o.schedule.kind === "expense",
            )
            .reduce((s, o) => s + o.schedule.amountCents, 0);
          return sum + Math.max(0, b.amountCents - actual - scheduled);
        },
        0,
      );
      monthlyAllowance.set(month, {
        amount: residual,
        days: Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1,
        start: first,
      });
    }
    const allowance = monthlyAllowance.get(month)!;
    const index = Math.round(
      (Date.parse(cursor) - Date.parse(allowance.start)) / 86400000,
    );
    const variable = Number(
      (BigInt(allowance.amount) * BigInt(index + 1)) / BigInt(allowance.days) -
        (BigInt(allowance.amount) * BigInt(index)) / BigInt(allowance.days),
    );
    const scheduled = planned
      .filter(
        (o) =>
          o.date === cursor ||
          (cursor === addDays(start, 1) && o.date === start),
      )
      .reduce(
        (s, o) =>
          s + (o.schedule.kind === "income" ? 1 : -1) * o.schedule.amountCents,
        0,
      );
    balance += scheduled - variable;
    points.push({
      date: cursor,
      balanceCents: balance,
      scheduledCents: scheduled,
      allowanceCents: variable,
    });
  }
  return points;
}
export function assetValue(asset: Asset, date: string): number {
  const valuation = [...asset.valuations]
    .filter((v) => v.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (valuation?.amountCents ?? 0) * (asset.kind === "liability" ? -1 : 1);
}
export function netWorth(snapshot: Snapshot, date: string): number {
  return (
    snapshot.accounts.reduce(
      (sum, a) => sum + accountBalance(a, snapshot.transactions, date),
      0,
    ) + snapshot.assets.reduce((sum, a) => sum + assetValue(a, date), 0)
  );
}
export function overview(snapshot: Snapshot, owner = "all") {
  const transactions = snapshot.transactions.filter(
    (t) => owner === "all" || t.owner === owner,
  );
  const month = snapshot.today.slice(0, 7);
  const current = transactions.filter(
    (t) => t.date.startsWith(month) && t.date <= snapshot.today,
  );
  const income = current
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amountCents, 0);
  const spent = -current
    .filter((t) => t.kind === "expense" || t.kind === "refund")
    .reduce((s, t) => s + t.amountCents, 0);
  const balance = snapshot.accounts
    .filter((a) => owner === "all" || a.owner === owner)
    .reduce(
      (s, a) => s + accountBalance(a, snapshot.transactions, snapshot.today),
      0,
    );
  const budgets = effectiveBudgets(snapshot.budgets, month);
  const budget = budgets.reduce((s, b) => s + b.amountCents, 0);
  const budgetSpent = budgets.reduce(
    (sum, b) =>
      sum +
      categorySpend(snapshot.transactions, b.categoryId, month, snapshot.today),
    0,
  );
  return { income, spent, balance, budget, remaining: budget - budgetSpent };
}
export function annualSubscriptionCost(schedule: Schedule): number {
  return Math.round(
    schedule.amountCents *
      (schedule.frequency === "weekly"
        ? 52
        : schedule.frequency === "fortnightly"
          ? 26
          : schedule.frequency === "monthly"
            ? 12
            : schedule.frequency === "quarterly"
              ? 4
              : 1),
  );
}
