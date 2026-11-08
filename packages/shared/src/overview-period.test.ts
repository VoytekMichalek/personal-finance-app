import { describe, expect, it } from "vitest";
import {
  categoryIcon,
  overview,
  overviewPeriod,
  type Account,
  type Category,
  type Snapshot,
  type Transaction,
} from "./index.js";

describe("dashboard calendar periods", () => {
  it("uses inclusive calendar boundaries, leap days and current-day cutoffs", () => {
    expect(overviewPeriod("2026-11-08", "2024-02")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
      month: "2024-02",
    });
    expect(overviewPeriod("2026-11-08", "2026-10", "year")).toEqual({
      from: "2026-01-01",
      to: "2026-11-08",
      month: "2026-11",
    });
    expect(overviewPeriod("2027-01-01", undefined, "year").from).toBe(
      "2027-01-01",
    );
    for (const month of ["invalid", "2026-13", "2027-01"])
      expect(overviewPeriod("2026-11-08", month)).toEqual({
        from: "2026-11-01",
        to: "2026-11-08",
        month: "2026-11",
      });
  });
  it("nets refunds, excludes transfers, future and prior-year rows, and keeps current balances", () => {
    const account: Account = {
      id: "a",
      name: "Bank",
      type: "bank",
      institution: "",
      owner: "household",
      openingDate: "2025-01-01",
      openingBalanceCents: 100000,
      archived: false,
    };
    const tx = (
      date: string,
      kind: Transaction["kind"],
      amountCents: number,
      owner = "household",
    ): Transaction => ({
      id: date + kind,
      version: 1,
      accountId: "a",
      date,
      kind,
      amountCents,
      owner,
      description: kind,
      categoryId: null,
      notes: "",
      transferGroupId: null,
      scheduleId: null,
      occurrenceDate: null,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const data: Snapshot = {
      today: "2026-11-08",
      accounts: [account],
      transactions: [
        tx("2026-01-01", "income", 10000),
        tx("2026-03-01", "expense", -5000),
        tx("2026-11-08", "expense", -1000),
        tx("2026-11-08", "refund", 200),
        tx("2026-04-01", "transfer", -999),
        tx("2025-12-31", "income", 99999),
        tx("2026-11-09", "expense", -99999),
        tx("2026-02-01", "expense", -300, "someone"),
      ],
      categories: [],
      budgets: [],
      budgetOverrides: [],
      rules: [],
      schedules: [],
      assets: [],
      people: [],
    };
    const year = overview(data, "household", undefined, "year");
    expect(year).toMatchObject({ income: 10000, spent: 5800 });
    expect(overview(data, "all", undefined, "year").spent).toBe(6100);
    const month = overview(data, "household");
    expect(month.spent).toBe(800);
    expect(year.balance).toBe(month.balance);
  });
});
it("uses chosen, recognised and inherited category icons without requiring a migration of existing categories", () => {
  const parent: Category = {
    id: "p",
    name: "Unusual",
    parentId: null,
    kind: "expense",
    color: "#123456",
    icon: "cloud",
    archived: false,
  };
  expect(categoryIcon({ name: "Groceries", parentId: null })).toBe("basket");
  expect(
    categoryIcon({ name: "Groceries", parentId: null, icon: "heart" }),
  ).toBe("heart");
  expect(categoryIcon({ name: "Custom child", parentId: "p" }, [parent])).toBe(
    "cloud",
  );
  expect(categoryIcon({ name: "Healthcare", parentId: null })).toBe("heart");
  expect(categoryIcon()).toBe("tag");
});
