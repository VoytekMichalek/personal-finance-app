import { expect, it } from "vitest";
import {
  bankLayoutStatement,
  bankTableHeading,
  bankTableRow,
} from "../../integration/bank-layout-fixture.js";
import { statementPdf } from "../../integration/statement-fixture.js";
import { parseStatement } from "./parser.js";
import { extractPdf } from "./pdf.js";

it("reads all pages of a cross-year bank PDF with hyphenated dates, processed dates and wrapped descriptions", async () => {
  const pages = await extractPdf(statementPdf(bankLayoutStatement()));
  const { rows, details } = parseStatement(pages, "household", 2026);
  expect(pages).toHaveLength(3);
  expect(rows.map((row) => row.date)).toEqual([
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
  ]);
  expect(rows.map((row) => row.amountCents)).toEqual([
    25000, -20000, -1250, 3000, 250,
  ]);
  expect(rows.map((row) => row.description)).toEqual([
    "From: Savings Rent",
    "To: Property Team 3/14 Example - rent",
    "Cafe Plan 9.99 Card purchase",
    "From: Friend",
    "Interest",
  ]);
  expect(rows.every((row) => row.include && !row.error)).toBe(true);
  expect(details.opening).toEqual({ date: "2025-12-30", amountCents: 50000 });
  expect(details.closing).toEqual({ date: "2026-01-03", amountCents: 57000 });
  expect(details.warnings).toEqual([]);
  expect(
    details.lines.find((line) => line.text === "3/14 Example - rent"),
  ).toMatchObject({ rowNumber: 2, status: "transaction" });
  expect(
    details.lines
      .filter((line) => line.text.startsWith("Page "))
      .every((line) => line.rowNumber === null && line.status === "context"),
  ).toBe(true);
});

it("rejects a broken running balance rather than guessing a direction", () => {
  const pages = bankLayoutStatement();
  pages[1]![3] = bankTableRow(
    "01-Jan",
    "02-Jan",
    "Cafe",
    "-12.50",
    "",
    "538.50",
  );
  const { rows, details } = parseStatement(
    pages.map((page) => page.join("\n")),
    "household",
  );
  expect(rows[2]).toMatchObject({
    include: false,
    error: "Running balance does not reconcile. Check this line.",
  });
  expect(details.lines.some((line) => line.status === "review")).toBe(true);
});

it("keeps ambiguous or invalid hyphenated dates excluded without a printed year", () => {
  const { rows } = parseStatement(
    [
      "Statement period 2025 - 2026\nDate Details Amount\n31-Feb Shop -10.00\n01-Jan Shop -5.00",
    ],
    "household",
  );
  expect(rows).toHaveLength(2);
  expect(
    rows.every(
      (row) => !row.include && row.error?.includes("Date is ambiguous"),
    ),
  ).toBe(true);
});

it("does not mistake a lone running balance for the transaction amount", () => {
  const { rows } = parseStatement(
    [
      [
        "2026",
        bankTableHeading,
        bankTableRow("01-Jan", "01-Jan", "Shop", "", "", "9.00"),
      ].join("\n"),
    ],
    "household",
  );
  expect(rows[0]).toMatchObject({
    include: false,
    error: "Transaction amount or running balance is missing. Check this line.",
  });
});

it("does not attach off-column notes or a following page's content to a transaction", () => {
  const { rows, details } = parseStatement(
    [
      [
        "2026",
        bankTableHeading,
        bankTableRow("01-Jan", "01-Jan", "Shop", "-1.00", "", "9.00"),
        "Unrecognised payment 7.00",
        "                    Unrelated note",
      ].join("\n"),
      "                    Page introduction",
    ],
    "household",
  );
  expect(rows[0]?.description).toBe("Shop");
  expect(
    details.lines.find((line) => line.text.startsWith("Unrecognised"))?.status,
  ).toBe("review");
});
