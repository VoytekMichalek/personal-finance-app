import type { Snapshot } from "./types.js";
import { effectiveBudgets, shiftMonth } from "./budgets.js";
import { occurrences } from "./finance.js";
import { monthEnd } from "./money.js";

export type BudgetReportRow = {
  categoryId: string;
  budgetCents: number | null;
  actualCents: number;
  upcomingCents: number;
  varianceCents: number | null;
  availableCents: number | null;
  overridden: boolean;
};

/** Calendar-month actuals and future commitments; category allowances include bills. */
export function budgetReport(snapshot: Snapshot, month: string) {
  const from = month + "-01";
  const to = monthEnd(month);
  const through = to < snapshot.today ? to : snapshot.today;
  const rows = new Map<string, BudgetReportRow>();
  const row = (categoryId: string | null) => {
    const key = categoryId ?? "uncategorised";
    let item = rows.get(key);
    if (!item) {
      item = {
        categoryId: key,
        budgetCents: null,
        actualCents: 0,
        upcomingCents: 0,
        varianceCents: null,
        availableCents: null,
        overridden: false,
      };
      rows.set(key, item);
    }
    return item;
  };
  for (const budget of effectiveBudgets(
    snapshot.budgets,
    month,
    snapshot.budgetOverrides,
  )) {
    const item = row(budget.categoryId);
    item.budgetCents = budget.amountCents;
    item.overridden = !!budget.overrideId;
  }
  for (const transaction of snapshot.transactions) {
    if (
      transaction.date < from ||
      transaction.date > through ||
      !["expense", "refund"].includes(transaction.kind)
    )
      continue;
    row(transaction.categoryId).actualCents -= transaction.amountCents;
  }
  if (to >= snapshot.today) {
    for (const occurrence of occurrences(
      snapshot.schedules,
      snapshot.transactions,
      from > snapshot.today ? from : snapshot.today,
      to,
    )) {
      if (!occurrence.matched && occurrence.schedule.kind === "expense")
        row(occurrence.schedule.categoryId).upcomingCents +=
          occurrence.schedule.amountCents;
    }
  }
  for (const item of rows.values()) {
    if (item.budgetCents !== null) {
      item.varianceCents = item.budgetCents - item.actualCents;
      item.availableCents = item.varianceCents - item.upcomingCents;
    }
  }
  const items = [...rows.values()];
  const sum = (key: "budgetCents" | "actualCents" | "upcomingCents") =>
    items.reduce((total, item) => total + (item[key] ?? 0), 0);
  const budgetCents = sum("budgetCents"),
    actualCents = sum("actualCents"),
    upcomingCents = sum("upcomingCents");
  return {
    month,
    from,
    to,
    through,
    rows: items,
    budgetCents,
    actualCents,
    upcomingCents,
    varianceCents: budgetCents - actualCents,
    availableCents: budgetCents - actualCents - upcomingCents,
    unbudgetedCents: items
      .filter((item) => item.budgetCents === null)
      .reduce((total, item) => total + item.actualCents, 0),
    overBudgetCount: items.filter(
      (item) => item.varianceCents !== null && item.varianceCents < 0,
    ).length,
  };
}

export function budgetTrend(
  snapshot: Snapshot,
  throughMonth: string,
  count = 6,
) {
  return Array.from({ length: count }, (_, index) => {
    const report = budgetReport(
      snapshot,
      shiftMonth(throughMonth, index - count + 1),
    );
    return {
      month: report.month,
      budgetCents: report.budgetCents,
      actualCents: report.actualCents,
      varianceCents: report.varianceCents,
    };
  });
}
