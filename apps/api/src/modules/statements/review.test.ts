import { recoverBalances } from "./balances.js";
import { expect, it } from "vitest";
import { parseStatement } from "./parser.js";
import { recurringSuggestions } from "./suggestions.js";
it("reads previous card balance on the following line and keeps transactions before the stated period", () => {
  const { rows, details } = parseStatement(
    [
      "Statement period 07/01/2026 to 06/02/2026\nPrevious statement balance\n500.00\nDate Details Amount\n05/01/2026 Coles 80.00\nNew balance 580.00",
    ],
    "owner",
    undefined,
    "credit",
  );
  expect(details.opening).toEqual({ date: "2026-01-05", amountCents: -50000 });
  expect(details.closing?.amountCents).toBe(-58000);
  expect(rows[0]).toMatchObject({
    date: "2026-01-05",
    owner: "owner",
    amountCents: -8000,
    error: null,
  });
  expect(details.warnings).toEqual([]);
});
it("groups changing references and missing months, offers quarterly insurance with two observations", () => {
  const text = [
    "2026",
    ...["01", "02", "04", "05", "06"].flatMap((month, i) => [
      `05/${month}/2026 VISA SPOTIFY REF AB${100 + i} -14.99`,
      `08/${month}/2026 AAMI INSURANCE REF XY${200 + i} -110.00`,
      `12/${month}/2026 TELSTRA REF TS${300 + i} -89.00`,
      `16/${month}/2026 BUPA REF BU${400 + i} -225.00`,
    ]),
    "07/01/2026 ALLIANZ INSURANCE -330.00",
    "09/04/2026 ALLIANZ INSURANCE -345.00",
  ].join("\n");
  const { rows } = parseStatement([text], "owner");
  const suggestions = recurringSuggestions(rows, "account", "2026-10-10");
  expect(suggestions).toHaveLength(5);
  expect(
    suggestions.filter((s) => s.schedule.frequency === "monthly"),
  ).toHaveLength(4);
  expect(
    suggestions.find((s) => s.schedule.frequency === "quarterly")?.evidence,
  ).toHaveLength(2);
  expect(suggestions.every((s) => s.schedule.owner === "owner")).toBe(true);
});
it("does not infer recurring bills from a pair of incidental purchases or irregular payments", () => {
  const { rows } = parseStatement(
    [
      "2026\n01/01/2026 Shop -20.00\n01/02/2026 Shop -20.00\n02/01/2026 Insurance -20.00\n19/01/2026 Insurance -20.00\n23/04/2026 Insurance -20.00",
    ],
    "owner",
  );
  expect(recurringSuggestions(rows, "account", "2026-10-10")).toEqual([]);
});

it("reads a card summary's opening column without confusing it with the minimum payment", () => {
  const { rows, details } = parseStatement(
    [
      "2026\nNo. of Days in Statement Cycle    Statement From    Statement To    Minimum Payment Due    Due Date    Opening Balance\n30    7 Sep 26    6 Oct 26    35.00    20 Oct 26    500.00\nDate Details Amount\n05/09/2026 Coffee 25.00\nClosing Balance\n525.00",
    ],
    "owner",
    undefined,
    "credit",
  );
  recoverBalances(details, rows, "credit");
  expect(details.opening).toEqual({ date: "2026-09-05", amountCents: -50000 });
  expect(details.closing?.amountCents).toBe(-52500);
  expect(
    details.warnings.some((w) => /not identified|reconcile/i.test(w)),
  ).toBe(false);
});
it("does not treat an adjacent transaction or minimum payment as an opening balance", () => {
  const { rows, details } = parseStatement(
    ["2026\nOpening Balance    Minimum Payment\n05/09/2026 Coffee 25.00"],
    "owner",
    undefined,
    "credit",
  );
  recoverBalances(details, rows, "credit");
  expect(details.opening).toBeNull();
});
