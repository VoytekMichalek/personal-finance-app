import type { Snapshot, Transaction } from "./types.js";
export type ExpenseGroup = "categories" | "accounts" | "people";
const groupKey = (row: Transaction, group: ExpenseGroup) =>
  group === "categories"
    ? (row.categoryId ?? "uncategorised")
    : group === "accounts"
      ? row.accountId
      : row.owner;
export type ExpenseFilters = {
  from: string;
  to: string;
  accountIds?: string[];
  owners?: string[];
  categoryIds?: string[];
  search?: string;
  detail?: { group: ExpenseGroup; id: string };
};
export function expenseReport(
  data: Pick<Snapshot, "transactions" | "categories">,
  filters: ExpenseFilters,
) {
  const search = filters.search?.trim().toLowerCase();
  const rows = data.transactions.filter(
    (t) =>
      (t.kind === "expense" || t.kind === "refund") &&
      t.date >= filters.from &&
      t.date <= filters.to &&
      (!filters.accountIds?.length ||
        filters.accountIds.includes(t.accountId)) &&
      (!filters.owners?.length || filters.owners.includes(t.owner)) &&
      (!search || t.description.toLowerCase().includes(search)) &&
      (!filters.detail ||
        groupKey(t, filters.detail.group) === filters.detail.id) &&
      (!filters.categoryIds?.length ||
        filters.categoryIds.some((categoryId) =>
          categoryId === "uncategorised"
            ? t.categoryId === null
            : t.categoryId === categoryId ||
              data.categories.find((c) => c.id === t.categoryId)?.parentId ===
                categoryId,
        )),
  );
  const group = (key: (t: Transaction) => string) => {
    const totals = new Map<
      string,
      { id: string; amountCents: number; count: number }
    >();
    for (const row of rows) {
      const id = key(row),
        existing = totals.get(id) ?? { id, amountCents: 0, count: 0 };
      existing.amountCents -= row.amountCents;
      existing.count++;
      totals.set(id, existing);
    }
    return [...totals.values()].sort(
      (a, b) => b.amountCents - a.amountCents || a.id.localeCompare(b.id),
    );
  };
  const spendingCents = -rows
    .filter((r) => r.kind === "expense")
    .reduce((n, r) => n + r.amountCents, 0);
  const refundCents = rows
    .filter((r) => r.kind === "refund")
    .reduce((n, r) => n + r.amountCents, 0);
  return {
    rows,
    spendingCents: spendingCents || 0,
    refundCents,
    totalCents: spendingCents - refundCents || 0,
    categories: group((t) => t.categoryId ?? "uncategorised"),
    accounts: group((t) => t.accountId),
    people: group((t) => t.owner),
    months: group((t) => t.date.slice(0, 7)).sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

/** Calendar buckets include quiet periods; refunds reduce that period's spending. */
export function expenseTrend(rows: Transaction[], from: string, to: string) {
  const duration = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!Number.isFinite(duration) || duration < 0) return [];
  const daily = duration < 62;
  const key = (date: string) => (daily ? date : date.slice(0, 7) + "-01");
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (
      (row.kind !== "expense" && row.kind !== "refund") ||
      row.date < from ||
      row.date > to
    )
      continue;
    const date = key(row.date);
    totals.set(date, (totals.get(date) ?? 0) - row.amountCents);
  }
  const points: { date: string; amountCents: number }[] = [];
  const cursor = new Date(key(from) + "T00:00:00Z");
  while (cursor.toISOString().slice(0, 10) <= to) {
    const date = cursor.toISOString().slice(0, 10);
    points.push({ date, amountCents: totals.get(date) ?? 0 });
    if (daily) cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}
