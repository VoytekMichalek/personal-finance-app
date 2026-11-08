import { expect, it } from "vitest";
import { latestTransactionDates } from "./accounts.js";

it("finds the newest ledger date for each account regardless of insertion order", () => {
  expect([
    ...latestTransactionDates([
      { accountId: "a", date: "2026-11-02" },
      { accountId: "b", date: "2026-10-25" },
      { accountId: "a", date: "2026-01-01" },
      { accountId: "b", date: "2026-11-01" },
      { accountId: "a", date: "2026-11-02" },
    ]),
  ]).toEqual([
    ["a", "2026-11-02"],
    ["b", "2026-11-01"],
  ]);
  expect(latestTransactionDates([]).get("empty")).toBeUndefined();
});
