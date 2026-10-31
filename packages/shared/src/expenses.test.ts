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
    accountIds: ["card"],
    owners: ["person"],
    categoryIds: ["home"],
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
it("searches descriptions consistently across totals and groups while retaining every other filter", () => {
  const data = {
    categories,
    transactions: [
      row("spend", "expense", -4000, { description: "Funky shop" }),
      row("refund", "refund", 1500, { description: "FUNKY refund" }),
      row("unmatched", "expense", -999, { description: "Other purchase" }),
      row("uncategorised", "expense", -700, {
        description: "Funky uncategorised purchase",
        categoryId: null,
      }),
      row("other-person", "expense", -1000, {
        description: "Funky shop",
        owner: "household",
      }),
      row("other-account", "expense", -2000, {
        description: "Funky shop",
        accountId: "bank",
      }),
      row("outside", "expense", -3000, {
        description: "Funky shop",
        date: "2025-12-31",
      }),
      row("transfer", "transfer", -4000, { description: "Funky shop" }),
    ],
  };
  const filters = {
    from: "2026-01-01",
    to: "2026-01-31",
    owners: ["person"],
    accountIds: ["card"],
    categoryIds: ["home"],
    search: "  fUnKy  ",
  };
  const report = expenseReport(data, filters);
  expect(report.rows.map((item) => item.id)).toEqual(["spend", "refund"]);
  expect(report.spendingCents).toBe(4000);
  expect(report.refundCents).toBe(1500);
  expect(report.totalCents).toBe(2500);
  for (const group of [
    report.categories,
    report.accounts,
    report.people,
    report.months,
  ])
    expect(
      group.map(({ amountCents, count }) => ({ amountCents, count })),
    ).toEqual([{ amountCents: 2500, count: 2 }]);
  expect(
    expenseReport(data, {
      ...filters,
      detail: { group: "categories", id: "insurance" },
    }).rows,
  ).toEqual(report.rows);
  const uncategorised = expenseReport(data, {
    ...filters,
    categoryIds: ["uncategorised"],
  });
  expect(uncategorised.rows.map((item) => item.id)).toEqual(["uncategorised"]);
  expect(uncategorised.totalCents).toBe(700);
  expect(
    expenseReport(data, { ...filters, search: "   " }).rows.map(
      (item) => item.id,
    ),
  ).toEqual(["spend", "refund", "unmatched"]);
  expect(
    expenseReport(data, { ...filters, search: "not present" }).rows,
  ).toEqual([]);
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
    owners: ["person"],
    accountIds: ["card"],
  };
  const detail = expenseReport(data, {
    ...filters,
    categoryIds: ["home"],
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

it("unions multi-selections, intersects filter groups and counts parent/child overlaps only once", () => {
  const data = {
    categories,
    transactions: [
      row("a", "expense", -1000),
      row("b", "refund", 200, { owner: "household", accountId: "bank" }),
      row("c", "expense", -300, { categoryId: null }),
      row("other-account", "expense", -999, { accountId: "cash" }),
      row("other-person", "expense", -999, { owner: "other" }),
      row("other-category", "expense", -999, { categoryId: "dining" }),
    ],
  };
  const filters = {
    from: "2026-01-01",
    to: "2026-01-31",
    accountIds: ["card", "bank"],
    owners: ["person", "household"],
    categoryIds: ["home", "insurance", "uncategorised"],
  };
  const report = expenseReport(data, filters);
  expect(report.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(report.totalCents).toBe(1100);
  expect(
    expenseReport(data, {
      ...filters,
      detail: { group: "categories", id: "insurance" },
    }).totalCents,
  ).toBe(800);
  expect(
    expenseReport(data, {
      from: filters.from,
      to: filters.to,
      accountIds: [],
      owners: [],
      categoryIds: [],
    }).rows,
  ).toHaveLength(6);
});
