import { describe, it, expect } from "vitest";
import {
  parseMoney,
  accountBalance,
  categorySpend,
  forecast,
  scheduleDates,
  netWorth,
  effectiveBudgets,
  overview,
} from "./index.js";
import type {
  Account,
  Transaction,
  Schedule,
  Snapshot,
  Asset,
} from "./index.js";
const account: Account = {
  id: "bank",
  name: "Everyday",
  type: "bank",
  institution: "",
  owner: "household",
  openingDate: "2026-01-01",
  openingBalanceCents: 500000,
  archived: false,
};
const transaction = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "t",
  version: 1,
  accountId: "bank",
  kind: "expense",
  amountCents: -10000,
  date: "2026-10-01",
  description: "Groceries",
  categoryId: "food",
  owner: "household",
  notes: "",
  transferGroupId: null,
  scheduleId: null,
  occurrenceDate: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...patch,
});
const schedule = (patch: Partial<Schedule> = {}): Schedule => ({
  id: "bill",
  name: "Groceries",
  accountId: "bank",
  kind: "expense",
  amountCents: 20000,
  categoryId: "food",
  owner: "household",
  startDate: "2026-10-10",
  endDate: null,
  frequency: "monthly",
  subscription: false,
  provider: "",
  cancelled: false,
  ...patch,
});
const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  accounts: [account],
  transactions: [transaction()],
  categories: [],
  rules: [],
  budgetOverrides: [],
  budgets: [
    {
      id: "b",
      categoryId: "food",
      month: "2026-10",
      endMonth: null,
      amountCents: 100000,
    },
  ],
  schedules: [schedule()],
  assets: [],
  people: [],
  today: "2026-10-01",
  ...patch,
});
describe("exact financial arithmetic", () => {
  it("parses cents without floating-point rounding and rejects hidden fractions", () => {
    expect(parseMoney("$1,234.56")).toBe(123456);
    expect(parseMoney("(1.01)")).toBe(-101);
    expect(parseMoney("0.29")).toBe(29);
    expect(() => parseMoney("1.001")).toThrow();
    expect(() => parseMoney("1e3")).toThrow();
    expect(() => parseMoney("9007199254740992")).toThrow();
  });
  it("excludes transfers from spending and nets refunds", () => {
    const rows = [
      transaction(),
      transaction({ id: "refund", kind: "refund", amountCents: 2500 }),
      transaction({ id: "transfer", kind: "transfer", amountCents: -900000 }),
    ];
    expect(categorySpend(rows, "food", "2026-10")).toBe(7500);
  });
  it("respects opening balance dates and future transactions", () => {
    expect(accountBalance(account, [transaction()], "2025-12-31")).toBe(0);
    expect(accountBalance(account, [transaction()], "2026-09-30")).toBe(500000);
    expect(accountBalance(account, [transaction()], "2026-10-01")).toBe(490000);
  });
  it("uses latest budget without carrying unspent funds forward", () => {
    expect(
      effectiveBudgets(
        [
          {
            id: "a",
            categoryId: "food",
            month: "2026-09",
            endMonth: null,
            amountCents: 20000,
          },
          {
            id: "b",
            categoryId: "food",
            month: "2026-11",
            endMonth: null,
            amountCents: 30000,
          },
        ],
        "2026-10",
      )[0]?.amountCents,
    ).toBe(20000);
  });
});
describe("calendar recurrence and forecast", () => {
  it("includes recurring subscriptions within their budget and still projects bills over the allowance", () => {
    for (const scheduled of [15000, 23000]) {
      const points = forecast(
        snapshot({
          transactions: [],
          budgets: [
            {
              id: "subscriptions",
              categoryId: "subscriptions",
              month: "2026-10",
              endMonth: "2026-10",
              amountCents: 20000,
            },
          ],
          schedules: [
            schedule({ categoryId: "subscriptions", amountCents: scheduled }),
          ],
        }),
        30,
      );
      expect(points.reduce((sum, point) => sum + point.scheduledCents, 0)).toBe(
        -scheduled,
      );
      expect(points.reduce((sum, point) => sum + point.allowanceCents, 0)).toBe(
        Math.max(0, 20000 - scheduled),
      );
      expect(points.at(-1)?.balanceCents).toBe(
        500000 - Math.max(20000, scheduled),
      );
    }
  });
  it("uses monthly overrides in reporting and stops projecting expired plans", () => {
    const data = snapshot({
      transactions: [],
      schedules: [],
      budgets: [
        {
          id: "b",
          categoryId: "food",
          month: "2026-10",
          endMonth: "2026-11",
          amountCents: 10000,
        },
      ],
      budgetOverrides: [
        { id: "o", categoryId: "food", month: "2026-10", amountCents: 20000 },
      ],
    });
    expect(overview(data).budget).toBe(20000);
    expect(overview(data, "all", "2026-11").budget).toBe(10000);
    expect(overview(data, "all", "2026-12").budget).toBe(0);
    expect(
      forecast(data, 91).reduce((sum, point) => sum + point.allowanceCents, 0),
    ).toBe(30000);
  });
  it("keeps the original month-end anchor including leap years", () => {
    expect(
      scheduleDates(
        schedule({ startDate: "2024-01-31" }),
        "2024-01-01",
        "2024-04-30",
      ),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
    expect(
      scheduleDates(
        schedule({ startDate: "2024-02-29", frequency: "annually" }),
        "2024-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2024-02-29", "2025-02-28", "2026-02-28"]);
  });
  it("honours end dates and cancellation", () => {
    expect(
      scheduleDates(
        schedule({
          startDate: "2026-10-01",
          frequency: "fortnightly",
          endDate: "2026-10-20",
        }),
        "2026-10-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-10-01", "2026-10-15"]);
    expect(
      scheduleDates(schedule({ cancelled: true }), "2026-10-01", "2026-12-31"),
    ).toEqual([]);
  });
  it("does not count actual spending, budgets and scheduled bills twice", () => {
    const points = forecast(snapshot(), 30);
    expect(points[0]?.balanceCents).toBe(490000);
    expect(points.at(-1)?.balanceCents).toBe(400000);
    expect(points.reduce((s, p) => s + p.allowanceCents, 0)).toBe(70000);
    expect(points.reduce((s, p) => s + p.scheduledCents, 0)).toBe(-20000);
  });
  it("does not project matched occurrences again", () => {
    const data = snapshot({
      transactions: [
        transaction({
          amountCents: -30000,
          scheduleId: "bill",
          occurrenceDate: "2026-10-10",
        }),
      ],
    });
    expect(forecast(data, 30).at(-1)?.balanceCents).toBe(400000);
  });
  it("distributes indivisible cents exactly", () => {
    const points = forecast(
      snapshot({
        transactions: [],
        schedules: [],
        budgets: [
          {
            id: "b",
            categoryId: "food",
            month: "2026-10",
            endMonth: null,
            amountCents: 101,
          },
        ],
      }),
      30,
    );
    expect(points.reduce((s, p) => s + p.allowanceCents, 0)).toBe(101);
  });
  it("treats credit repayment as a neutral transfer", () => {
    const card = {
      ...account,
      id: "card",
      type: "credit" as const,
      openingBalanceCents: -20000,
    };
    const rows = [
      transaction({ kind: "transfer", amountCents: -10000 }),
      transaction({ accountId: "card", kind: "transfer", amountCents: 10000 }),
    ];
    expect(
      forecast(
        snapshot({
          accounts: [account, card],
          transactions: rows,
          schedules: [],
          budgets: [],
        }),
        1,
      )[0]?.balanceCents,
    ).toBe(480000);
  });
});

describe("household reporting boundaries", () => {
  it("reports a selected full month while preserving current balances and household budgets", () => {
    const data = snapshot({
      budgets: [
        {
          id: "september",
          categoryId: "food",
          month: "2026-09",
          endMonth: null,
          amountCents: 20000,
        },
        {
          id: "october",
          categoryId: "food",
          month: "2026-10",
          endMonth: null,
          amountCents: 100000,
        },
      ],
      transactions: [
        transaction({ date: "2026-09-01", kind: "income", amountCents: 50000 }),
        transaction({ date: "2026-09-30", amountCents: -10001 }),
        transaction({ date: "2026-09-30", kind: "refund", amountCents: 2501 }),
        transaction({ date: "2026-09-30", owner: "wife", amountCents: -2000 }),
        transaction({
          date: "2026-09-30",
          kind: "transfer",
          amountCents: -3000,
        }),
        transaction({
          date: "2026-09-30",
          kind: "transfer",
          amountCents: 3000,
        }),
        transaction({ kind: "income", amountCents: 1000 }),
        transaction({ amountCents: -9000 }),
        transaction({ date: "2026-10-02", amountCents: -6000 }),
      ],
    });
    expect(overview(data, "household", "2026-09")).toEqual({
      income: 50000,
      spent: 7500,
      balance: 532500,
      budget: 20000,
      remaining: 10500,
    });
    expect(overview(data, "all", "2026-09").spent).toBe(9500);
    expect(overview(data)).toEqual({
      income: 1000,
      spent: 9000,
      balance: 532500,
      budget: 100000,
      remaining: 91000,
    });
    expect(overview(data, "all", "2026-08")).toEqual({
      income: 0,
      spent: 0,
      balance: 532500,
      budget: 0,
      remaining: 0,
    });
  });
  it("filters transaction and account ownership while keeping household budgets inclusive", () => {
    const data = snapshot({
      transactions: [
        transaction({ owner: "wife" }),
        transaction({
          owner: "household",
          categoryId: "unbudgeted",
          amountCents: -5000,
        }),
      ],
    });
    const result = overview(data, "household");
    expect(result.spent).toBe(5000);
    expect(result.balance).toBe(485000);
    expect(result.remaining).toBe(90000);
    expect(overview(data, "wife").balance).toBe(0);
  });
  it("includes an unmatched bill due today once without adding another budget allowance", () => {
    const data = snapshot({
      schedules: [schedule({ startDate: "2026-10-01" })],
    });
    const points = forecast(data, 30);
    expect(points[1]?.scheduledCents).toBe(-20000);
    expect(points.at(-1)?.balanceCents).toBe(400000);
    expect(points.reduce((s, p) => s + p.allowanceCents, 0)).toBe(70000);
  });
});
describe("dated net worth", () => {
  it("uses historical valuations once without inventing earlier values", () => {
    const property: Asset = {
      id: "home",
      name: "Home",
      kind: "asset",
      classification: "property",
      owner: "household",
      archived: false,
      valuations: [
        {
          id: "v",
          assetId: "home",
          date: "2026-09-01",
          amountCents: 100000000,
        },
        {
          id: "v2",
          assetId: "home",
          date: "2026-11-01",
          amountCents: 110000000,
        },
      ],
    };
    expect(netWorth(snapshot({ assets: [property] }), "2026-08-31")).toBe(
      500000,
    );
    expect(netWorth(snapshot({ assets: [property] }), "2026-10-01")).toBe(
      100490000,
    );
  });
});

it("forecasts recurring transfers on each account while keeping household totals and spending neutral", () => {
  const target = { ...account, id: "savings", openingBalanceCents: 10000 };
  const recurring = schedule({
    kind: "transfer",
    counterAccountId: target.id,
    categoryId: null,
    amountCents: 2501,
  });
  const data = snapshot({
    accounts: [account, target],
    transactions: [],
    schedules: [recurring],
    budgets: [],
  });
  expect(forecast(data, 30).at(-1)?.balanceCents).toBe(510000);
  expect(
    forecast({ ...data, accounts: [account] }, 30).at(-1)?.balanceCents,
  ).toBe(497499);
  expect(
    forecast({ ...data, accounts: [target] }, 30).at(-1)?.balanceCents,
  ).toBe(12501);
  data.transactions = [
    transaction({
      kind: "transfer",
      categoryId: null,
      amountCents: -2501,
      scheduleId: recurring.id,
      occurrenceDate: recurring.startDate,
    }),
    transaction({
      id: "other",
      kind: "transfer",
      categoryId: null,
      accountId: target.id,
      amountCents: 2501,
    }),
  ];
  expect(
    forecast({ ...data, accounts: [target] }, 30).at(-1)?.balanceCents,
  ).toBe(12501);
  expect(Math.abs(overview(data, "all").spent)).toBe(0);
});
