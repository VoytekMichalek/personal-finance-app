import type { Transaction } from "./types.js";

export type ExpenseInterval = "month" | "week" | "day";
export type ExpenseCategoryPoint = {
  date: string;
  from: string;
  to: string;
  amountCents: number;
  amounts: number[];
};

function periodStart(date: string, interval: ExpenseInterval) {
  const value = new Date(date + "T00:00:00Z");
  if (interval === "month") value.setUTCDate(1);
  if (interval === "week")
    value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value;
}
function advance(date: Date, interval: ExpenseInterval) {
  if (interval === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + (interval === "week" ? 7 : 1));
}
const calendarDate = (date: Date) => date.toISOString().slice(0, 10);

/** Exact calendar buckets, with Monday–Sunday weeks and signed net category totals. */
export function expenseCategoryTrend(
  rows: Transaction[],
  from: string,
  to: string,
  interval: ExpenseInterval,
): { categoryIds: string[]; points: ExpenseCategoryPoint[] } {
  const duration = Date.parse(to) - Date.parse(from);
  if (!Number.isFinite(duration) || duration < 0)
    return { categoryIds: [], points: [] };
  const included = rows.filter(
    (row) =>
      (row.kind === "expense" || row.kind === "refund") &&
      row.date >= from &&
      row.date <= to,
  );
  const categoryIds = [
    ...new Set(included.map((row) => row.categoryId ?? "uncategorised")),
  ].sort();
  const indexes = new Map(categoryIds.map((id, index) => [id, index]));
  const buckets = new Map<string, ExpenseCategoryPoint>();
  const cursor = periodStart(from, interval);
  while (calendarDate(cursor) <= to) {
    const date = calendarDate(cursor);
    advance(cursor, interval);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() - 1);
    buckets.set(date, {
      date,
      from: date < from ? from : date,
      to: calendarDate(end) > to ? to : calendarDate(end),
      amountCents: 0,
      amounts: categoryIds.map(() => 0),
    });
  }
  for (const row of included) {
    const bucket = buckets.get(calendarDate(periodStart(row.date, interval)))!;
    const index = indexes.get(row.categoryId ?? "uncategorised")!;
    bucket.amounts[index] = (bucket.amounts[index] ?? 0) - row.amountCents;
    bucket.amountCents -= row.amountCents;
  }
  return { categoryIds, points: [...buckets.values()] };
}
