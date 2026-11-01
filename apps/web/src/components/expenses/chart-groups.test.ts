import { describe, expect, it } from "vitest";
import type { ExpenseCategoryPoint } from "@finance/shared";
import { chartGroupAmount, expenseChartGroups } from "./chart-groups";

const point = (amounts: number[]): ExpenseCategoryPoint => ({
  date: "2026-10-01",
  from: "2026-10-01",
  to: "2026-10-31",
  amounts,
  amountCents: amounts.reduce((sum, amount) => sum + amount, 0),
});
const series = ["a", "b", "c", "d", "e", "f", "g", "uncategorised"].map(
  (id) => ({ id, name: id, colour: "#123456" }),
);

describe("expense chart grouping", () => {
  it("keeps five largest named categories and uncategorised, preserving exact totals", () => {
    const month = point([100, 200, 300, 400, 500, 60, -25, 10000]);
    const groups = expenseChartGroups(series, [month], false);
    expect(groups.map((group) => group.id)).toEqual([
      "e",
      "d",
      "c",
      "b",
      "a",
      "uncategorised",
      "remaining",
    ]);
    const remaining = groups.at(-1)!;
    expect(chartGroupAmount(month, remaining)).toBe(35);
    expect(chartGroupAmount(month, remaining, "positive")).toBe(60);
    expect(chartGroupAmount(month, remaining, "negative")).toBe(-25);
    expect(
      groups.reduce((sum, group) => sum + chartGroupAmount(month, group), 0),
    ).toBe(month.amountCents);
  });
  it("ranks refund activity by magnitude and expands every category without losing zero-net activity", () => {
    const points = [
      point([100, 200, 300, 400, 500, 600, -700, 10]),
      point([0, 0, 0, 0, 0, -600, 0, 0]),
    ];
    const expanded = expenseChartGroups(series, points, true);
    expect(expanded.map((group) => group.id)).toEqual([
      "f",
      "g",
      "e",
      "d",
      "c",
      "b",
      "a",
      "uncategorised",
    ]);
    expect(expanded.every((group) => group.indexes.length === 1)).toBe(true);
    for (const month of points)
      expect(
        expanded.reduce(
          (sum, group) => sum + chartGroupAmount(month, group),
          0,
        ),
      ).toBe(month.amountCents);
  });
  it("does not add an empty Remaining group and orders ties consistently", () => {
    expect(
      expenseChartGroups(
        series.slice(0, 2).reverse(),
        [point([100, 100])],
        false,
      ).map((group) => group.id),
    ).toEqual(["a", "b"]);
    expect(expenseChartGroups([], [], false)).toEqual([]);
    expect(
      expenseChartGroups(series.slice(-1), [point([0])], false).map(
        (group) => group.id,
      ),
    ).toEqual(["uncategorised"]);
  });
});
