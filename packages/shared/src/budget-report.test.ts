import { describe, expect, it } from "vitest";
import { budgetReport, budgetTrend } from "./budget-report.js";
import type { Snapshot, Transaction, Schedule } from "./types.js";
const transaction = (patch: Partial<Transaction>): Transaction => ({
  id: "t",
  accountId: "bank",
  kind: "expense",
  amountCents: -5000,
  date: "2026-11-01",
  description: "Subscription",
  categoryId: "subs",
  owner: "household",
  notes: "",
  version: 1,
  transferGroupId: null,
  scheduleId: null,
  occurrenceDate: null,
  createdAt: "2026-11-01T00:00:00Z",
  ...patch,
});
const schedule = (patch: Partial<Schedule>): Schedule => ({
  id: "schedule",
  name: "Upcoming subscription",
  accountId: "bank",
  kind: "expense",
  amountCents: 10000,
  categoryId: "subs",
  owner: "household",
  startDate: "2026-11-15",
  endDate: null,
  frequency: "monthly",
  subscription: true,
  provider: "",
  cancelled: false,
  ...patch,
});
const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  today: "2026-11-03",
  accounts: [],
  transactions: [transaction({})],
  budgets: [
    {
      id: "b",
      categoryId: "subs",
      month: "2026-10",
      endMonth: "2026-12",
      amountCents: 20000,
    },
  ],
  budgetOverrides: [],
  categories: [],
  people: [],
  rules: [],
  schedules: [schedule({})],
  assets: [],
  ...patch,
});

describe("budget vs actual reporting", () => {
  it("shows actual, future bills and free allowance separately without double counting", () => {
    expect(budgetReport(snapshot(), "2026-11")).toMatchObject({
      budgetCents: 20000,
      actualCents: 5000,
      upcomingCents: 10000,
      varianceCents: 15000,
      availableCents: 5000,
      unbudgetedCents: 0,
    });
  });
  it("nets refunds, excludes transfers and income, and highlights spending without a budget", () => {
    const report = budgetReport(
      snapshot({
        transactions: [
          transaction({}),
          transaction({ id: "refund", kind: "refund", amountCents: 1000 }),
          transaction({
            id: "transfer",
            kind: "transfer",
            amountCents: -100000,
          }),
          transaction({ id: "salary", kind: "income", amountCents: 500000 }),
          transaction({
            id: "shopping",
            categoryId: "shopping",
            amountCents: -3500,
          }),
          transaction({ id: "uncat", categoryId: null, amountCents: -500 }),
        ],
      }),
      "2026-11",
    );
    expect(report).toMatchObject({
      actualCents: 8000,
      unbudgetedCents: 4000,
      availableCents: 2000,
    });
    expect(
      report.rows.find((row) => row.categoryId === "shopping"),
    ).toMatchObject({
      budgetCents: null,
      actualCents: 3500,
      varianceCents: null,
    });
    expect(
      report.rows.find((row) => row.categoryId === "uncategorised")
        ?.actualCents,
    ).toBe(500);
  });
  it("excludes already matched, cancelled, income and transfer occurrences", () => {
    const report = budgetReport(
      snapshot({
        schedules: [
          schedule({ id: "paid", startDate: "2026-11-03" }),
          schedule({ id: "cancelled", cancelled: true }),
          schedule({ id: "salary", kind: "income" }),
          schedule({ id: "transfer", kind: "transfer" }),
        ],
        transactions: [
          transaction({ scheduleId: "paid", occurrenceDate: "2026-11-03" }),
        ],
      }),
      "2026-11",
    );
    expect(report.upcomingCents).toBe(0);
    expect(report.actualCents).toBe(5000);
  });
  it("uses monthly overrides and explicit zero budgets, including over-budget bills", () => {
    const report = budgetReport(
      snapshot({
        budgetOverrides: [
          {
            id: "override",
            categoryId: "subs",
            month: "2026-11",
            amountCents: 0,
          },
        ],
      }),
      "2026-11",
    );
    expect(report).toMatchObject({
      budgetCents: 0,
      actualCents: 5000,
      upcomingCents: 10000,
      availableCents: -15000,
      overBudgetCount: 1,
      unbudgetedCents: 0,
    });
    expect(report.rows[0]?.overridden).toBe(true);
  });
  it("keeps categories and subcategories separate and totals exact cents", () => {
    const report = budgetReport(
      snapshot({
        transactions: [
          transaction({ categoryId: "child", amountCents: -1001 }),
        ],
        schedules: [schedule({ categoryId: "child", amountCents: 999 })],
      }),
      "2026-11",
    );
    expect(report).toMatchObject({
      actualCents: 1001,
      upcomingCents: 999,
      availableCents: 18000,
      unbudgetedCents: 1001,
    });
    expect(
      report.rows.find((row) => row.categoryId === "subs")?.availableCents,
    ).toBe(20000);
  });
  it("respects month boundaries, today's cutoff, future months and plan expiry in trends", () => {
    const data = snapshot({
      transactions: [
        transaction({ date: "2026-10-31", amountCents: -1001 }),
        transaction({ date: "2026-11-03", amountCents: -2002 }),
        transaction({ date: "2026-11-04", amountCents: -9999 }),
      ],
    });
    expect(budgetReport(data, "2026-10")).toMatchObject({
      actualCents: 1001,
      upcomingCents: 0,
      through: "2026-10-31",
    });
    expect(budgetReport(data, "2026-11").actualCents).toBe(2002);
    expect(budgetReport(data, "2026-12")).toMatchObject({
      actualCents: 0,
      upcomingCents: 10000,
    });
    expect(budgetReport(data, "2027-01").budgetCents).toBe(0);
    expect(
      budgetTrend(data, "2027-01", 4).map((point) => [
        point.month,
        point.budgetCents,
        point.actualCents,
      ]),
    ).toEqual([
      ["2026-10", 20000, 1001],
      ["2026-11", 20000, 2002],
      ["2026-12", 20000, 0],
      ["2027-01", 0, 0],
    ]);
  });
});
