import { expect, it } from "vitest";
import { expenseReport, expenseTrend } from "./expenses.js";
import type { Category, Transaction } from "./types.js";
const categories = [
  { id: "home", parentId: null },
  { id: "insurance", parentId: "home" },
] as Category[];
const row = (
  id: string,
  kind: Transaction["kind"],
  amountCents: number,
  patch: Partial<Transaction> = {},
) =>
  ({
    id,
    kind,
    amountCents,
    date: "2026-01-05",
    accountId: "card",
    owner: "person",
    categoryId: "insurance",
    ...patch,
  }) as Transaction;
it("deducts refunds, excludes transfers and income, and filters people/accounts/date/category descendants", () => {
  const data = {
    categories,
    transactions: [
      row("1", "expense", -12551),
      row("2", "refund", 2001),
      row("3", "transfer", -60000),
      row("4", "income", 40000),
      row("5", "expense", -1000, { owner: "household", accountId: "bank" }),
      row("6", "expense", -999, { date: "2025-12-31" }),
    ],
  };
  const all = expenseReport(data, { from: "2026-01-01", to: "2026-01-31" });
  expect(all.totalCents).toBe(11550);
  expect(all.people).toEqual([
    { id: "person", amountCents: 10550, count: 2 },
    { id: "household", amountCents: 1000, count: 1 },
  ]);
  const selected = expenseReport(data, {
    from: "2026-01-05",
    to: "2026-01-05",
    accountId: "card",
    owner: "person",
    categoryId: "home",
  });
  expect(selected.totalCents).toBe(10550);
  expect(selected.refundCents).toBe(2001);
  expect(selected.rows.map((r) => r.id)).toEqual(["1", "2"]);
  expect(selected.months).toEqual([
    { id: "2026-01", amountCents: 10550, count: 2 },
  ]);
  expect(
    expenseReport(data, { from: "2026-02-01", to: "2026-01-01" }).totalCents,
  ).toBe(0);
});
it("retains net refunds and uncategorised spending", () => {
  const report = expenseReport(
    {
      categories,
      transactions: [row("1", "refund", 2000, { categoryId: null })],
    },
    { from: "2026-01-01", to: "2026-02-01" },
  );
  expect(report.categories).toEqual([
    { id: "uncategorised", amountCents: -2000, count: 1 },
  ]);
});
it("drills into the exact category, account or person without losing report filters", () => {
  const data = {
    categories,
    transactions: [
      row("child", "expense", -10000),
      row("refund", "refund", 2000),
      row("parent", "expense", -3000, { categoryId: "home" }),
      row("other-owner", "expense", -9000, { owner: "household" }),
      row("uncategorised", "expense", -1000, { categoryId: null }),
      row("other-account", "expense", -4000, { accountId: "bank" }),
    ],
  };
  const filters = {
    from: "2026-01-01",
    to: "2026-01-31",
    owner: "person",
    accountId: "card",
  };
  const detail = expenseReport(data, {
    ...filters,
    categoryId: "home",
    detail: { group: "categories", id: "insurance" },
  });
  expect(detail.rows.map((r) => r.id)).toEqual(["child", "refund"]);
  expect(detail.totalCents).toBe(8000);
  expect(
    expenseReport(data, {
      ...filters,
      detail: { group: "categories", id: "uncategorised" },
    }).totalCents,
  ).toBe(1000);
  expect(
    expenseReport(data, {
      ...filters,
      detail: { group: "accounts", id: "bank" },
    }).rows,
  ).toEqual([]);
  expect(
    expenseReport(data, {
      ...filters,
      detail: { group: "people", id: "household" },
    }).rows,
  ).toEqual([]);
});
it("fills daily and monthly trend gaps and keeps refunds below zero", () => {
  const rows = [
    row("spend", "expense", -10005, { date: "2026-01-31" }),
    row("refund", "refund", 2005, { date: "2026-02-02" }),
    row("transfer", "transfer", -9999, { date: "2026-02-01" }),
    row("outside", "expense", -9999, { date: "2026-02-03" }),
  ];
  expect(expenseTrend(rows, "2026-01-31", "2026-02-02")).toEqual([
    { date: "2026-01-31", amountCents: 10005 },
    { date: "2026-02-01", amountCents: 0 },
    { date: "2026-02-02", amountCents: -2005 },
  ]);
  const months = expenseTrend(rows.slice(0, 3), "2026-01-31", "2026-04-03");
  expect(months).toEqual([
    { date: "2026-01-01", amountCents: 10005 },
    { date: "2026-02-01", amountCents: -2005 },
    { date: "2026-03-01", amountCents: 0 },
    { date: "2026-04-01", amountCents: 0 },
  ]);
  expect(months.reduce((n, p) => n + p.amountCents, 0)).toBe(8000);
  expect(expenseTrend(rows, "2026-02-02", "2026-01-31")).toEqual([]);
});
