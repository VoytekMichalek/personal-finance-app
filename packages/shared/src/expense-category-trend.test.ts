import { expect, it } from "vitest";
import { expenseCategoryTrend } from "./expense-category-trend.js";
import { expenseReport } from "./expenses.js";
import type { Transaction } from "./types.js";

const row = (
  date: string,
  amountCents: number,
  categoryId: string | null = "food",
  kind: Transaction["kind"] = "expense",
) =>
  ({
    date,
    amountCents,
    categoryId,
    kind,
    accountId: "bank",
    owner: "person",
  }) as Transaction;

it("stacks exact category cents, subtracts refunds, excludes other kinds and fills quiet months", () => {
  const rows = [
    row("2026-01-31", -10005),
    row("2026-01-31", -4002, null),
    row("2026-01-31", 2001, "food", "refund"),
    row("2026-03-01", 3002, "food", "refund"),
    row("2026-01-01", -500),
    row("2026-04-01", -500),
    row("2026-02-01", -999, "food", "transfer"),
    row("2026-02-01", 999, "food", "income"),
  ];
  const result = expenseCategoryTrend(
    rows,
    "2026-01-15",
    "2026-03-10",
    "month",
  );
  expect(result.categoryIds).toEqual(["food", "uncategorised"]);
  expect(result.points).toEqual([
    {
      date: "2026-01-01",
      from: "2026-01-15",
      to: "2026-01-31",
      amounts: [8004, 4002],
      amountCents: 12006,
    },
    {
      date: "2026-02-01",
      from: "2026-02-01",
      to: "2026-02-28",
      amounts: [0, 0],
      amountCents: 0,
    },
    {
      date: "2026-03-01",
      from: "2026-03-01",
      to: "2026-03-10",
      amounts: [-3002, 0],
      amountCents: -3002,
    },
  ]);
});

it("uses Monday–Sunday weeks across year boundaries and clips partial weeks to the filter", () => {
  const result = expenseCategoryTrend(
    [
      row("2025-12-28", -999),
      row("2025-12-31", -101),
      row("2026-01-04", -202),
      row("2026-01-05", -303),
      row("2026-01-12", -404),
      row("2026-01-13", -999),
    ],
    "2025-12-31",
    "2026-01-12",
    "week",
  );
  expect(result.points).toEqual([
    {
      date: "2025-12-29",
      from: "2025-12-31",
      to: "2026-01-04",
      amounts: [303],
      amountCents: 303,
    },
    {
      date: "2026-01-05",
      from: "2026-01-05",
      to: "2026-01-11",
      amounts: [303],
      amountCents: 303,
    },
    {
      date: "2026-01-12",
      from: "2026-01-12",
      to: "2026-01-12",
      amounts: [404],
      amountCents: 404,
    },
  ]);
});

it("preserves calendar days through leap days and daylight-saving boundaries", () => {
  const leap = expenseCategoryTrend(
    [row("2024-02-29", -101)],
    "2024-02-28",
    "2024-03-01",
    "day",
  );
  expect(leap.points.map((point) => [point.date, point.amountCents])).toEqual([
    ["2024-02-28", 0],
    ["2024-02-29", 101],
    ["2024-03-01", 0],
  ]);
  const dst = expenseCategoryTrend(
    [row("2026-10-04", -102)],
    "2026-10-03",
    "2026-10-05",
    "day",
  );
  expect(dst.points.map((point) => point.date)).toEqual([
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
  ]);
});

it.each(["month", "week", "day"] as const)(
  "reconciles %s stacks with the filtered report including zero-net categories",
  (interval) => {
    const rows = [
      row("2026-01-02", -10005),
      row("2026-01-03", 10005, "food", "refund"),
      row("2026-01-03", -222, null),
      { ...row("2026-01-03", -999), owner: "household" },
    ];
    const report = expenseReport(
      { transactions: rows, categories: [] },
      {
        from: "2026-01-01",
        to: "2026-02-03",
        owners: ["person"],
        accountIds: ["bank"],
      },
    );
    const result = expenseCategoryTrend(
      report.rows,
      "2026-01-01",
      "2026-02-03",
      interval,
    );
    expect(result.categoryIds).toEqual(["food", "uncategorised"]);
    expect(
      result.points.reduce((total, point) => total + point.amountCents, 0),
    ).toBe(report.totalCents);
    for (const point of result.points)
      expect(point.amounts.reduce((sum, amount) => sum + amount, 0)).toBe(
        point.amountCents,
      );
  },
);

it("returns safe empty results for invalid ranges and zero buckets for empty selections", () => {
  expect(expenseCategoryTrend([], "2026-02-01", "2026-01-01", "month")).toEqual(
    { categoryIds: [], points: [] },
  );
  expect(expenseCategoryTrend([], "invalid", "2026-01-01", "day")).toEqual({
    categoryIds: [],
    points: [],
  });
  expect(expenseCategoryTrend([], "2026-01-01", "2026-01-01", "day")).toEqual({
    categoryIds: [],
    points: [
      {
        date: "2026-01-01",
        from: "2026-01-01",
        to: "2026-01-01",
        amounts: [],
        amountCents: 0,
      },
    ],
  });
});
