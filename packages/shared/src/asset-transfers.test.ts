import { expect, it } from "vitest";
import {
  assetHistory,
  assetValue,
  forecast,
  netWorth,
  overview,
} from "./finance.js";
import type {
  Account,
  Asset,
  Snapshot,
  Transaction,
  Schedule,
} from "./types.js";

const account = (
  id: string,
  type: Account["type"],
  openingBalanceCents = 0,
): Account => ({
  id,
  type,
  openingBalanceCents,
  name: id,
  institution: "",
  owner: "household",
  openingDate: "2026-01-01",
  archived: false,
});
const asset = (
  id: string,
  kind: Asset["kind"],
  amountCents: number,
): Asset => ({
  id,
  accountId: id,
  name: id,
  kind,
  classification: "other",
  owner: "household",
  archived: false,
  valuations: [
    { id: id + "-value", assetId: id, date: "2026-10-01", amountCents },
  ],
});
const shares = asset("shares", "asset", 500000);
const loan = asset("loan", "liability", 800000);
function transfer(
  from: string,
  to: string,
  amountCents: number,
  date = "2026-10-02",
): Transaction[] {
  return [from, to].map((accountId, i) => ({
    id: accountId + date,
    accountId,
    date,
    amountCents: amountCents * (i ? 1 : -1),
    kind: "transfer",
    version: 1,
    description: "Transfer",
    categoryId: null,
    owner: "household",
    notes: "",
    transferGroupId: from + to + date,
    scheduleId: null,
    occurrenceDate: null,
    createdAt: date + "T00:00:00Z",
  }));
}
const snapshot = (transactions: Transaction[] = []): Snapshot => ({
  today: "2026-10-02",
  transactions,
  accounts: [
    account("bank", "bank", 1000000),
    account("shares", "asset"),
    account("loan", "liability"),
  ],
  assets: [shares, loan],
  categories: [],
  rules: [],
  budgets: [],
  schedules: [],
  people: [],
});

it("investment contributions and loan repayments preserve net worth without inflating cash or income", () => {
  const data = snapshot([
    ...transfer("bank", "shares", 50000),
    ...transfer("bank", "loan", 25000),
  ]);
  expect(assetValue(shares, data.today, data.transactions)).toBe(550000);
  expect(assetValue(loan, data.today, data.transactions)).toBe(-775000);
  expect(netWorth(data, data.today)).toBe(700000);
  expect(overview(data)).toMatchObject({
    income: 0,
    spent: 0,
    balance: 925000,
  });
  expect(forecast(data, 1)[0]!.balanceCents).toBe(925000);
});
it("withdrawals and borrowing move value in the opposite direction with no income/spending", () => {
  const data = snapshot([
    ...transfer("shares", "bank", 20000),
    ...transfer("loan", "bank", 10000),
  ]);
  expect(assetValue(shares, data.today, data.transactions)).toBe(480000);
  expect(assetValue(loan, data.today, data.transactions)).toBe(-810000);
  expect(netWorth(data, data.today)).toBe(700000);
  expect(overview(data)).toMatchObject({
    income: 0,
    spent: 0,
    balance: 1030000,
  });
});
it("closing valuations include earlier/same-day transfers and only later flows are added", () => {
  const valued = {
    ...shares,
    valuations: [
      ...shares.valuations,
      {
        id: "new",
        assetId: shares.id,
        date: "2026-10-02",
        amountCents: 570000,
      },
    ],
  };
  const rows = [
    ...transfer("bank", "shares", 50000),
    ...transfer("bank", "shares", 10000, "2026-10-03"),
  ];
  expect(assetValue(valued, "2026-10-01", rows)).toBe(500000);
  expect(assetValue(valued, "2026-10-02", rows)).toBe(570000);
  expect(assetValue(valued, "2026-10-03", rows)).toBe(580000);
  expect(
    netWorth({ ...snapshot(rows), assets: [valued, loan] }, "2026-10-03"),
  ).toBe(720000);
});
it("keeps dated transfer history, ignores future entries and can start an investment from zero", () => {
  const rows = [
    ...transfer("bank", "shares", 50000),
    ...transfer("bank", "shares", 9000, "2026-10-04"),
  ];
  expect(assetHistory(shares, rows, "2026-10-03")).toEqual([
    { date: "2026-10-01", balanceCents: 500000 },
    { date: "2026-10-02", balanceCents: 550000 },
  ]);
  expect(assetValue({ ...shares, valuations: [] }, "2026-10-02", rows)).toBe(
    50000,
  );
  expect(
    assetValue({ ...shares, accountId: undefined }, "2026-10-02", rows),
  ).toBe(500000);
});
it("scheduled asset transfers reduce available-cash forecasts without posting future asset values", () => {
  const data = snapshot();
  data.schedules = [
    {
      id: "scheduled",
      name: "Invest",
      accountId: "bank",
      counterAccountId: "shares",
      kind: "transfer",
      amountCents: 50000,
      categoryId: null,
      owner: "household",
      startDate: "2026-10-03",
      endDate: null,
      frequency: "monthly",
      subscription: false,
      provider: "",
      cancelled: false,
    } satisfies Schedule,
  ];
  expect(forecast(data, 1)[1]).toMatchObject({
    balanceCents: 950000,
    scheduledCents: -50000,
  });
  expect(netWorth(data, "2026-10-03")).toBe(700000);
});
