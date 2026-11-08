import { expect, it } from "vitest";
import { statementRowDateText } from "@finance/shared";
import {
  hsbcHeading,
  hsbcRow,
  hsbcStatement,
} from "../../integration/hsbc-fixture.js";
import { statementPdf } from "../../integration/statement-fixture.js";
import { parseStatement } from "./parser.js";
import { extractPdf } from "./pdf.js";

const parse = (pages = hsbcStatement(), year?: number) =>
  parseStatement(
    pages.map((page) => page.join("\n")),
    "household",
    year,
  );

it("reads grouped dates, every debit/credit and cross-page descriptions from a real HSBC-layout PDF", async () => {
  const pages = await extractPdf(statementPdf(hsbcStatement()));
  const { rows, details } = parseStatement(pages, "household");
  expect(pages).toHaveLength(4);
  expect(rows.map((row) => row.amountCents)).toEqual([
    -1000, 20, -200, -2000, 40, 10000, -500, 5000, -1250,
  ]);
  expect(rows.map((row) => row.date)).toEqual([
    "2025-12-30",
    "2025-12-30",
    "2025-12-31",
    "2025-12-31",
    "2025-12-31",
    "2025-12-31",
    "2026-01-01",
    "2026-01-01",
    "2026-01-02",
  ]);
  expect(rows[0]?.description).toBe("EFTPOS VISA AUD Grocery Example Town AU");
  expect(rows[3]?.description).toBe("Cafe Central AU");
  expect(rows[8]?.description).toBe("Plan 12.50 reference");
  expect(rows.every((row) => row.include && !row.error)).toBe(true);
  expect(details.opening).toEqual({ date: "2025-12-30", amountCents: 50000 });
  expect(details.closing).toEqual({ date: "2026-01-02", amountCents: 60110 });
  expect(details.warnings).toEqual([]);
  expect(
    details.lines.find((line) => line.text === "Central AU"),
  ).toMatchObject({ page: 3, rowNumber: 4, status: "transaction" });
  expect(statementRowDateText(details, 5)).toBe("31 Dec");
  expect(
    details.lines
      .filter((line) => /Not a transaction|Disclosure/.test(line.text))
      .every((line) => line.status === "context" && !line.rowNumber),
  ).toBe(true);
});

it("excludes all rows since the last reconciled checkpoint when a grouped balance disagrees", () => {
  const pages = hsbcStatement();
  pages[2]![6] = hsbcRow("", "Transfer from savings", "", "100.00", "569.60");
  const { rows, details } = parse(pages);
  expect(rows.slice(0, 2).every((row) => row.include)).toBe(true);
  expect(
    rows
      .slice(2, 6)
      .every((row) => !row.include && row.error?.includes("Running balance")),
  ).toBe(true);
  expect(details.lines.find((line) => line.text === "Central AU")?.status).toBe(
    "review",
  );
});

it.each(["Transaction Total", "Transaction Number"])(
  "checks printed %s even if omitted transactions would leave the same closing balance",
  (label) => {
    const pages = hsbcStatement();
    const index = pages[2]!.findIndex((line) => line.includes(label));
    pages[2]![index] = hsbcRow(
      "",
      label,
      label.endsWith("Total") ? "50.50" : "6",
      label.endsWith("Total") ? "151.60" : "5",
    );
    const { rows, details } = parse(pages);
    expect(
      rows.every(
        (row) => !row.include && row.error?.includes("totals or counts"),
      ),
    ).toBe(true);
    expect(details.warnings.join(" ")).toContain(
      "totals or counts do not match",
    );
  },
);

it("does not infer transactions from a lone balance, both amount columns or malformed amounts", () => {
  const { rows, details } = parse([
    [
      "HSBC Bank Australia 2026",
      hsbcHeading,
      hsbcRow("01 Jan", "BALANCE BROUGHT FORWARD", "", "", "100.00"),
      hsbcRow("01 Jan", "Missing amount", "", "", "90.00"),
      hsbcRow("", "Both columns", "1.00", "1.00"),
      hsbcRow("", "Malformed amount", "1.OO"),
    ],
  ]);
  expect(rows).toEqual([]);
  expect(details.lines.filter((line) => line.status === "review")).toHaveLength(
    3,
  );
});

it("keeps a missing year repairable using the posting date rather than a date in the merchant reference", () => {
  const pages = [
    [
      "HSBC Bank Australia",
      hsbcHeading,
      hsbcRow("01 Jan", "BALANCE BROUGHT FORWARD", "", "", "100.00"),
      hsbcRow("02 Jan", "Grocery", "10.00"),
      hsbcRow("", "01 Jan reference Cashback", "", "0.20", "90.20"),
    ],
  ];
  const result = parse(pages);
  expect(
    result.rows.every((row) => !row.include && row.error?.includes("Date")),
  ).toBe(true);
  expect(statementRowDateText(result.details, 2)).toBe("02 Jan");
  expect(
    parse(pages, 2026).rows.every(
      (row) => row.date === "2026-01-02" && row.include,
    ),
  ).toBe(true);
});

it("recognises overdraft balances without reversing debit or credit columns", () => {
  const { rows, details } = parse([
    [
      "HSBC Bank Australia 2026",
      hsbcHeading,
      hsbcRow("01 Jan", "BALANCE BROUGHT FORWARD", "", "", "10.00"),
      hsbcRow("02 Jan", "Purchase", "20.00", "", "10.00 DR"),
      hsbcRow("", "Cashback", "", "1.00", "9.00 DR"),
      hsbcRow("03 Jan", "CLOSING BALANCE", "", "", "9.00 DR"),
    ],
  ]);
  expect(rows.map((row) => row.amountCents)).toEqual([-2000, 100]);
  expect(details.closing).toEqual({ date: "2026-01-03", amountCents: -900 });
  expect(details.warnings).toEqual([]);
});

it.each(["Account 987654321 Currency AUD", "Account 123456789 Currency USD"])(
  "rejects an extra account/currency section: %s",
  (extra) => {
    const pages = hsbcStatement();
    pages[3]!.push(extra);
    expect(() => parse(pages)).toThrow(
      "Export a statement for just this AUD account",
    );
  },
);

it("does not inherit a date from an unrelated page without an account continuation header", () => {
  const pages = hsbcStatement();
  pages[2]![2] = "Unrelated page";
  const { rows } = parse(pages);
  expect(rows[4]).toMatchObject({ date: "", include: false });
});
