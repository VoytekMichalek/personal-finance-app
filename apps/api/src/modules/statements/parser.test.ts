import { describe, it, expect } from "vitest";
import { parseStatement } from "./parser.js";
import { categorise, recurringSuggestions } from "./suggestions.js";
import { extractPdf } from "./pdf.js";
import {
  statementPdf,
  sixMonthStatement,
} from "../../integration/statement-fixture.js";
describe("statement reading", () => {
  it("reads every page of six months, reconciles and suggests salary and subscriptions", async () => {
    const pages = await extractPdf(statementPdf(sixMonthStatement()));
    expect(pages).toHaveLength(6);
    const { rows, details } = parseStatement(pages, "household");
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => !r.error)).toBe(true);
    expect(details.opening).toEqual({
      date: "2026-01-01",
      amountCents: 100000,
    });
    expect(details.closing?.amountCents).toBe(1888000);
    expect(details.warnings).toEqual([]);
    categorise(
      rows,
      [
        {
          id: "salary",
          name: "Salary",
          kind: "income",
          color: "#ffffff",
          archived: false,
        },
        {
          id: "sub",
          name: "Subscriptions",
          kind: "expense",
          color: "#ffffff",
          archived: false,
        },
      ],
      [],
    );
    expect(rows[1]?.categoryId).toBe("sub");
    const recurring = recurringSuggestions(rows, "account", "2026-10-10");
    expect(recurring).toHaveLength(2);
    expect(recurring.map((r) => r.evidence.length)).toEqual([6, 6]);
    expect(recurring[1]?.schedule).toMatchObject({
      subscription: true,
      frequency: "monthly",
      startDate: "2026-11-02",
      amountCents: 2000,
    });
  });
  it("does not silently accept unsigned ambiguous lines or invalid dates", () => {
    const { rows, details } = parseStatement(
      [
        "2026\nDate Details Amount\n31/02/2026 Shop 40.00\n01/03/2026 Mystery 30.00\nUnrecognised entry 12.00",
      ],
      "household",
    );
    expect(rows.every((r) => r.error && !r.include)).toBe(true);
    expect(details.lines.filter((l) => l.status === "review")).toHaveLength(3);
  });
  it("recognises credit owed, refunds, rules and retains unmatched source context", () => {
    const { rows, details } = parseStatement(
      [
        "2026\nOpening balance 200.00 DR\nDate Details Amount Balance\n01/01/2026 Refund +50.00 150.00 DR\nClosing balance 150.00 DR",
      ],
      "household",
    );
    expect(rows[0]?.amountCents).toBe(5000);
    expect(details.opening?.amountCents).toBe(-20000);
    expect(details.warnings).toEqual([]);
  });
  it("normalises card debt, charges, payments and refunds from running balances", () => {
    const { rows, details } = parseStatement(
      [
        "2026\nOpening balance 500.00\nDate Details Amount Balance\n01/01/2026 Coles 80.00 580.00\n02/01/2026 Payment received 200.00 CR 380.00\n03/01/2026 Coles refund 20.00 CR 360.00\nClosing balance 360.00",
      ],
      "household",
      undefined,
      "credit",
    );
    expect(rows.map((r) => r.amountCents)).toEqual([-8000, 20000, 2000]);
    expect(rows.every((r) => !r.error)).toBe(true);
    expect(details.opening?.amountCents).toBe(-50000);
    expect(details.closing?.amountCents).toBe(-36000);
    expect(details.warnings).toEqual([]);
  });
  it("reads unsigned card purchases and recognises an overpaid CR balance", () => {
    const { rows, details } = parseStatement(
      [
        "2026\nOpening balance 20.00 CR\nDate Details Amount\n01/01/2026 Coffee 5.00\n02/01/2026 Payment -10.00\nClosing balance 25.00 CR",
      ],
      "household",
      undefined,
      "credit",
    );
    expect(rows.map((r) => r.amountCents)).toEqual([-500, 1000]);
    expect(details.closing?.amountCents).toBe(2500);
    expect(details.warnings).toEqual([]);
  });
  it("flags unsigned card credits when their direction has no balance or column evidence", () => {
    const { rows } = parseStatement(
      ["2026\nDate Details Amount\n01/01/2026 Payment received 100.00"],
      "household",
      undefined,
      "credit",
    );
    expect(rows[0]?.include).toBe(false);
    expect(rows[0]?.error).toContain("Cannot determine");
  });
  it("rejects malformed files", async () => {
    await expect(extractPdf(Buffer.from("not pdf"))).rejects.toThrow(
      "valid PDF",
    );
  });
  it("avoids treating irregular purchases as subscriptions", () => {
    const { rows } = parseStatement(
      [
        "2026\n01/01/2026 Shop -20.00\n03/01/2026 Shop -21.00\n20/02/2026 Shop -18.00",
      ],
      "household",
    );
    expect(recurringSuggestions(rows, "account", "2026-10-10")).toEqual([]);
  });
});
