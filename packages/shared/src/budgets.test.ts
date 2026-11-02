import { describe, expect, it } from "vitest";
import { effectiveBudgets, shiftMonth } from "./budgets.js";
import type { Budget, BudgetOverride } from "./types.js";

const plan = (patch: Partial<Budget> = {}): Budget => ({
  id: "plan",
  categoryId: "food",
  month: "2026-11",
  endMonth: "2027-01",
  amountCents: 50000,
  ...patch,
});
const override = (patch: Partial<BudgetOverride> = {}): BudgetOverride => ({
  id: "override",
  categoryId: "food",
  month: "2026-11",
  amountCents: 70000,
  ...patch,
});
describe("budget plan periods and monthly overrides", () => {
  it("includes both boundary months and ends across a year boundary", () => {
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
    for (const month of ["2026-11", "2026-12", "2027-01"])
      expect(effectiveBudgets([plan()], month)[0]?.amountCents).toBe(50000);
    for (const month of ["2026-10", "2027-02"])
      expect(effectiveBudgets([plan()], month)).toEqual([]);
  });
  it("limits one-off budgets to their starting month", () => {
    const budgets = [plan({ endMonth: "2026-11" })];
    expect(effectiveBudgets(budgets, "2026-11")).toHaveLength(1);
    expect(effectiveBudgets(budgets, "2026-12")).toEqual([]);
  });
  it("preserves old ongoing plans and applies the latest active plan within its period", () => {
    const budgets = [
      plan(),
      plan({
        id: "legacy",
        month: "2026-01",
        endMonth: null,
        amountCents: 30000,
      }),
    ];
    expect(effectiveBudgets(budgets, "2026-10")[0]?.amountCents).toBe(30000);
    expect(effectiveBudgets(budgets, "2026-12")[0]?.amountCents).toBe(50000);
    expect(effectiveBudgets(budgets, "2027-02")[0]?.amountCents).toBe(30000);
  });
  it("overrides the first month without changing later months or other categories", () => {
    const budgets = [
      plan(),
      plan({ id: "rent", categoryId: "rent", amountCents: 200000 }),
    ];
    const overrides = [override()];
    expect(effectiveBudgets(budgets, "2026-11", overrides)).toEqual([
      {
        ...plan(),
        amountCents: 70000,
        overrideId: "override",
        plannedAmountCents: 50000,
      },
      { ...budgets[1], overrideId: null, plannedAmountCents: 200000 },
    ]);
    expect(
      effectiveBudgets(budgets, "2026-12", overrides)[0]?.amountCents,
    ).toBe(50000);
    expect(budgets[0]?.amountCents).toBe(50000);
  });
  it("supports zero overrides and restores the underlying plan when removed", () => {
    expect(
      effectiveBudgets([plan()], "2026-11", [override({ amountCents: 0 })])[0]
        ?.amountCents,
    ).toBe(0);
    expect(effectiveBudgets([plan()], "2026-11", [])[0]?.amountCents).toBe(
      50000,
    );
  });
  it("retains an explicit override even if the underlying plan is shortened", () => {
    const result = effectiveBudgets(
      [plan({ endMonth: "2026-11" })],
      "2026-12",
      [override({ month: "2026-12" })],
    );
    expect(result[0]).toMatchObject({
      amountCents: 70000,
      overrideId: "override",
      plannedAmountCents: null,
      endMonth: "2026-12",
    });
  });
});
