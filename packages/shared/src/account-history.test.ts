import { expect, it } from "vitest";
import { accountHistory } from "./account-history.js";
import type { Account, Transaction } from "./types.js";
const account = {
  id: "a",
  openingDate: "2026-01-01",
  openingBalanceCents: 100000,
} as Account;
const row = (
  date: string,
  amountCents: number,
  kind = "expense",
  accountId = "a",
) => ({ date, amountCents, kind, accountId }) as Transaction;
const rows = [
  row("2025-12-31", -99999),
  row("2026-01-01", -1000),
  row("2026-01-01", 200),
  row("2026-01-03", -5000, "transfer"),
  row("2026-01-03", 10000, "income"),
  row("2026-01-04", 400, "refund"),
  row("2026-01-05", -99999),
  row("2026-01-03", 99999, "income", "b"),
];
it("includes same-day activity, transfers and refunds in exact daily balances", () => {
  const result = accountHistory(account, rows, "2026-01-01", "2026-01-04");
  expect(result).toMatchObject({
    openingCents: 100000,
    moneyInCents: 10600,
    moneyOutCents: 6000,
    netCents: 4600,
    closingCents: 104600,
  });
  expect(result.points.map((point) => point.balanceCents)).toEqual([
    99200, 99200, 104200, 104600,
  ]);
});
it("carries earlier history into a filtered period and retains quiet days", () => {
  expect(
    accountHistory(account, rows, "2026-01-02", "2026-01-03"),
  ).toMatchObject({
    openingCents: 99200,
    closingCents: 104200,
    points: [
      { date: "2026-01-02", balanceCents: 99200 },
      { date: "2026-01-03", balanceCents: 104200 },
    ],
  });
  expect(
    accountHistory(account, [], "2026-01-01", "2026-01-02").points.map(
      (point) => point.balanceCents,
    ),
  ).toEqual([100000, 100000]);
});
it("clamps to the account opening and ignores invalid or pre-opening periods", () => {
  expect(
    accountHistory(account, rows, "2025-01-01", "2026-01-01"),
  ).toMatchObject({ from: "2026-01-01", closingCents: 99200 });
  expect(
    accountHistory(account, rows, "2025-01-01", "2025-12-31").points,
  ).toEqual([]);
  expect(
    accountHistory(account, rows, "2026-02-01", "2026-01-01").points,
  ).toEqual([]);
});
