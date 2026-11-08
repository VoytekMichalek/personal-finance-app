import { expect, it } from "vitest";
import { statementRowDateText } from "@finance/shared";
import {
  qantasMerchant,
  qantasExchange,
  qantasPdf,
  qantasRow,
  qantasStatement,
} from "../../integration/qantas-fixture.js";
import { parseStatement } from "./parser.js";
import { extractPdf } from "./pdf.js";

const parse = (pages = qantasStatement()) =>
  parseStatement(
    pages.map((page) => page.join("\n")),
    "household",
  );

it("reads real PDF columns, wrapped merchants, cross-page settlements, AUD wallets and New Year dates", async () => {
  const pages = await extractPdf(qantasPdf());
  const { rows, details } = parseStatement(pages, "household");
  expect(pages).toHaveLength(3);
  expect(rows.map((row) => row.amountCents)).toEqual([
    -1234, 325, -750, 10000, -2000,
  ]);
  expect(rows.map((row) => row.date)).toEqual([
    "2026-01-18",
    "2026-01-13",
    "2026-01-06",
    "2026-01-05",
    "2025-12-29",
  ]);
  expect(rows[0]?.description).toBe("PURCHASE EXAMPLE GROCER BRISBANE QLD");
  expect(rows[1]?.kind).toBe("refund");
  expect(rows[3]).toMatchObject({ kind: "transfer", counterAccountId: null });
  expect(rows.every((row) => row.include && !row.error)).toBe(true);
  expect(details.opening).toEqual({ date: "2025-12-21", amountCents: 50000 });
  expect(details.closing).toEqual({ date: "2026-01-20", amountCents: 56341 });
  expect(details.lines.filter((line) => line.status === "review")).toEqual([]);
  expect(details.warnings).toEqual([
    expect.stringContaining("Choose the funding account"),
  ]);
  expect(statementRowDateText(details, 1)).toBe("18-01-2026");
  expect(
    details.lines.find(
      (line) => line.page === 3 && line.text.startsWith("Exchange"),
    ),
  ).toMatchObject({ rowNumber: 5, status: "transaction" });
});

it("flags an orphan exchange amount without inventing a date or overwriting the adjacent transaction", () => {
  const { rows, details } = parse(qantasStatement(true));
  expect(rows.map((row) => row.amountCents)).toEqual([
    -1234, 325, -750, 10000, -2000,
  ]);
  expect(details.lines.filter((line) => line.status === "review")).toEqual([
    expect.objectContaining({
      text: expect.stringContaining("-9.99 AUD"),
      rowNumber: null,
    }),
  ]);
  expect(details.warnings.join(" ")).toContain("no matching dated transaction");
  expect(details.warnings.join(" ")).toContain("does not match");
});

it.each(["-7.50 USD", "-7.5O AUD", ""])(
  "does not treat a missing or foreign wallet amount as AUD: %s",
  (amount) => {
    const pages = qantasStatement();
    pages[1] = pages[1]!.map((line) =>
      line === qantasExchange("-7.50 AUD") ? qantasExchange(amount) : line,
    );
    const { rows, details } = parse(pages);
    expect(rows).toHaveLength(4);
    expect(rows.some((row) => row.description.includes("OVERSEAS"))).toBe(
      false,
    );
    expect(details.warnings.join(" ")).toContain(
      "no unambiguous AUD wallet amount",
    );
  },
);

it("does not pick a foreign currency balance when the AUD summary is absent", () => {
  const pages = qantasStatement();
  pages[0] = pages[0]!.map((line) =>
    line.replace(/500.00 AUD\s+|563.41 AUD\s+/, ""),
  );
  const { details } = parse(pages);
  expect(details.opening).toBeNull();
  expect(details.closing).toBeNull();
});

it("keeps invalid source dates visible and rejects malformed dated amounts rather than borrowing settlements", () => {
  const pages = qantasStatement();
  pages[1] = pages[1]!.map((line) => line.replace("13-01-2026", "31-02-2026"));
  const result = parse(pages);
  expect(result.rows[1]).toMatchObject({
    date: "",
    include: false,
    amountCents: 325,
  });
  expect(statementRowDateText(result.details, 2)).toBe("31-02-2026");
  pages[1]![4] = qantasRow(
    "13-01-2026",
    "CREDIT VOUCHER",
    "EXAMPLE REFUND",
    "bad3.25 AUD",
  );
  expect(parse(pages).rows).toHaveLength(4);
});

it("joins several merchant lines before the date without donating them to the previous entry", () => {
  const pages = qantasStatement();
  pages[1]!.splice(
    6,
    0,
    qantasMerchant("ANOTHER MERCHANT"),
    qantasMerchant("SECOND LINE"),
  );
  const { rows } = parse(pages);
  expect(rows[1]?.description).toBe("CREDIT VOUCHER EXAMPLE REFUND");
  expect(rows[2]?.description).toBe(
    "PURCHASE ANOTHER MERCHANT SECOND LINE EXAMPLE OVERSEAS",
  );
});

it("excludes conflicting merchant and wallet signs and ambiguous AUD settlements", () => {
  const pages = qantasStatement();
  pages[1] = pages[1]!.map((line) =>
    line === qantasExchange("-7.50 AUD") ? qantasExchange("7.50 AUD") : line,
  );
  expect(parse(pages).rows[2]).toMatchObject({
    include: false,
    error: expect.stringContaining("different signs"),
  });
  pages[1]!.splice(8, 0, qantasExchange("-8.00 AUD"));
  expect(parse(pages).rows).toHaveLength(4);
});

it("does not reverse prepaid balances through a credit-card account", () => {
  expect(() =>
    parseStatement(
      qantasStatement().map((page) => page.join("\n")),
      "household",
      undefined,
      "credit",
    ),
  ).toThrow("Choose a bank account");
});

it("fails with recovery guidance for a foreign-only wallet instead of falling through to generic OCR/AI", () => {
  const pages = qantasStatement().map((page) =>
    page.map((line) => line.replaceAll("AUD", "USD")),
  );
  expect(() => parse(pages)).toThrow(
    "Export the AUD wallet as a clearer PDF or CSV",
  );
});
