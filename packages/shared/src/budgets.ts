import type { Budget, BudgetOverride, EffectiveBudget } from "./types.js";

export function shiftMonth(month: string, offset: number): string {
  const index =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + offset;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function effectiveBudgets(
  budgets: Budget[],
  month: string,
  overrides: BudgetOverride[] = [],
): EffectiveBudget[] {
  const result = new Map<string, EffectiveBudget>();
  for (const budget of [...budgets].sort((a, b) =>
    a.month.localeCompare(b.month),
  )) {
    if (budget.month <= month && (!budget.endMonth || month <= budget.endMonth))
      result.set(budget.categoryId, {
        ...budget,
        overrideId: null,
        plannedAmountCents: budget.amountCents,
      });
  }
  for (const override of overrides.filter((item) => item.month === month)) {
    const plan = result.get(override.categoryId);
    result.set(override.categoryId, {
      ...(plan ?? { ...override, endMonth: month, plannedAmountCents: null }),
      amountCents: override.amountCents,
      overrideId: override.id,
    });
  }
  return [...result.values()];
}
