import { expect, it } from "vitest";
import {
  balanceOutlook,
  forecast,
  spendingHistory,
  type Snapshot,
  type Transaction,
} from "./index.js";

const row = (patch: Partial<Transaction>): Transaction => ({
  id: "t",
  version: 1,
  accountId: "bank",
  owner: "voytek",
  kind: "expense",
  amountCents: -10000,
  date: "2026-10-15",
  description: "Purchase",
  categoryId: null,
  notes: "",
  transferGroupId: null,
  scheduleId: null,
  occurrenceDate: null,
  createdAt: "2026-10-15T00:00:00Z",
  ...patch,
});
const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  today: "2026-11-02",
  accounts: [
    {
      id: "bank",
      name: "Bank",
      type: "bank",
      owner: "voytek",
      institution: "",
      openingDate: "2026-06-01",
      openingBalanceCents: 100000,
      archived: false,
    },
  ],
  transactions: [],
  categories: [],
  rules: [],
  budgets: [],
  schedules: [],
  assets: [],
  people: [],
  ...patch,
});

it("joins recorded daily balances to an identical forecast starting balance and distinguishes missing history", () => {
  const data = snapshot({
    transactions: [
      row({}),
      row({ date: "2026-11-02", kind: "income", amountCents: 20000 }),
      row({ date: "2026-11-03", amountCents: -99999 }),
    ],
    budgets: [
      { id: "budget", categoryId: "food", month: "2026-11", amountCents: 3000 },
    ],
  });
  const result = balanceOutlook(data);
  expect(result.from).toBe("2026-05-02");
  expect(result.to).toBe("2027-02-02");
  expect(result.points[0]).toEqual({
    date: "2026-05-02",
    actualCents: null,
    projectedCents: null,
  });
  expect(result.points.find((p) => p.date === "2026-06-01")).toEqual({
    date: "2026-06-01",
    actualCents: 100000,
    projectedCents: null,
  });
  expect(result.points.find((p) => p.date === data.today)).toEqual({
    date: data.today,
    actualCents: 110000,
    projectedCents: 110000,
  });
  const future = result.points.filter((p) => p.date > data.today);
  expect(future.every((p) => p.actualCents === null)).toBe(true);
  expect(future.map((p) => p.projectedCents)).toEqual(
    forecast(data, 92)
      .slice(1)
      .map((p) => p.balanceCents),
  );
  expect(result.points.at(-1)?.projectedCents).toBe(100786);
});

it("keeps asset accounts out of available funds and internal transfers neutral, including archived cash history", () => {
  const data = snapshot();
  data.accounts.push(
    {
      ...data.accounts[0]!,
      id: "cash",
      type: "cash",
      archived: true,
      openingBalanceCents: 50000,
    },
    {
      ...data.accounts[0]!,
      id: "shares",
      type: "asset",
      openingBalanceCents: 999999,
    },
  );
  data.transactions = [
    row({ kind: "transfer", amountCents: -15000 }),
    row({ kind: "transfer", accountId: "cash", amountCents: 15000 }),
  ];
  expect(
    balanceOutlook(data).points.find((p) => p.date === data.today)?.actualCents,
  ).toBe(150000);
});

it("uses six complete months, ownership, refunds and exact calendar ranges for spending links", () => {
  const data = snapshot({
    transactions: [
      row({}),
      row({ kind: "refund", amountCents: 2500 }),
      row({ owner: "nicola", amountCents: -5000 }),
      row({ kind: "income", amountCents: 90000 }),
      row({ kind: "transfer", amountCents: -90000 }),
      row({ date: "2026-11-01", amountCents: -60000 }),
      row({ date: "2026-04-30", amountCents: -60000 }),
    ],
  });
  const result = spendingHistory(data, "voytek");
  expect(result).toHaveLength(6);
  expect(result[0]).toEqual({
    from: "2026-05-01",
    to: "2026-05-31",
    spentCents: -0,
    count: 0,
  });
  expect(result.at(-1)).toEqual({
    from: "2026-10-01",
    to: "2026-10-31",
    spentCents: 7500,
    count: 2,
  });
  expect(spendingHistory(data).at(-1)?.spentCents).toBe(12500);
});

it("clamps calendar-month endpoints at leap days and handles an empty household", () => {
  const result = balanceOutlook(
    snapshot({ today: "2027-11-30", accounts: [] }),
  );
  expect(result.to).toBe("2028-02-29");
  expect(result.points.every((p) => p.actualCents === null)).toBe(true);
  expect(result.points.at(-1)?.projectedCents).toBe(0);
  expect(spendingHistory(snapshot({ today: "2028-03-31" })).at(-1)?.to).toBe(
    "2028-02-29",
  );
});
