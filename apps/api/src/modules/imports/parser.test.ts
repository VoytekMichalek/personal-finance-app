import { describe, it, expect } from "vitest";
import { csvRecords, parseDate, parseRows, readCsv } from "./parser.js";
const mapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: "Amount",
  debitColumn: "",
  creditColumn: "",
  dateFormat: "DMY" as const,
};
describe("bank CSV boundaries", () => {
  it("detects a headerless bank export without dropping its first transaction", () => {
    const csv =
      "30/09/2026,-19.99,Hotel Brisbane Card xx1234,1000\n" +
      "29/09/2026,-10,Cafe,1019.99\n".repeat(599);
    const detected = readCsv(csv);
    expect(detected.hasHeaders).toBe(false);
    expect(detected.rows).toHaveLength(600);
    expect(detected.rows[0]).toMatchObject({
      "Column 1": "30/09/2026",
      "Column 2": "-19.99",
    });
    expect(readCsv(csv, true).rows).toHaveLength(599);
  });
  it("keeps a named header row and accepts an explicit headerless override", () => {
    expect(
      readCsv("Date,Description,Amount\n30/09/2026,Cafe,-10").hasHeaders,
    ).toBe(true);
    expect(readCsv("not a date,Some merchant,-10", false).rows).toHaveLength(1);
  });
  it("does not mistake punctuation in a quoted header for the delimiter", () => {
    expect(
      csvRecords(
        'Date,"Description; details",Amount\n01/10/2026,"Shop, Brisbane",-19.99',
      )[0],
    ).toEqual({
      Date: "01/10/2026",
      "Description; details": "Shop, Brisbane",
      Amount: "-19.99",
    });
  });
  it.each([
    "",
    "Date,Description,Amount",
    "Date,Amount,Amount\n01/10/2026,Shop,2",
    "Date,,Amount\n01/10/2026,Shop,2",
    "Date,Description,Amount\n01/10/2026,Shop,2,unexpected",
  ])("rejects empty, lossy or malformed files: %j", (csv) => {
    expect(() => csvRecords(csv)).toThrow();
  });
  it("enforces the transaction row limit", () => {
    expect(() =>
      csvRecords(
        "Date,Description,Amount\n" + "01/10/2026,Shop,-1\n".repeat(10001),
      ),
    ).toThrow("10,000");
  });
  it("only reverses signed amounts when explicitly selected", () => {
    const records = csvRecords(
      "Date,Description,Amount\n01/10/2026,Shop,19.99\n02/10/2026,Refund,-2.01",
    );
    expect(
      parseRows(records, { ...mapping, invertAmounts: true }, "household").map(
        (r) => r.amountCents,
      ),
    ).toEqual([-1999, 201]);
    expect(parseRows(records, mapping, "household")[0]?.amountCents).toBe(1999);
  });
  it("handles BOMs, quoted commas and exact signed amounts", () => {
    const rows = parseRows(
      csvRecords(
        '\uFEFFDate,Description,Amount\n01/10/2026,"Shop, Brisbane",-19.99',
      ),
      mapping,
      "household",
    );
    expect(rows[0]).toMatchObject({
      date: "2026-10-01",
      description: "Shop, Brisbane",
      amountCents: -1999,
      error: null,
    });
  });
  it("requires an explicit date format for ambiguous dates", () => {
    expect(parseDate("03/04/2026", "DMY")).toBe("2026-04-03");
    expect(parseDate("03/04/2026", "MDY")).toBe("2026-03-04");
    expect(() => parseDate("31/02/2026", "DMY")).toThrow();
  });
  it("preserves legitimate identical source rows", () => {
    expect(
      parseRows(
        csvRecords(
          "Date,Description,Amount\n01/10/2026,Shop,-1\n01/10/2026,Shop,-1",
        ),
        mapping,
        "household",
      ),
    ).toHaveLength(2);
  });
  it("excludes invalid rows and rejects simultaneous debit and credit", () => {
    const parsed = parseRows(
      csvRecords("Date,Description,Debit,Credit\n01/10/2026,Shop,10,2"),
      {
        ...mapping,
        amountColumn: "",
        debitColumn: "Debit",
        creditColumn: "Credit",
      },
      "household",
    );
    expect(parsed[0]?.include).toBe(false);
    expect(parsed[0]?.error).toContain("Both debit");
  });
  it("rejects columns not present in the source", () =>
    expect(() =>
      parseRows(
        csvRecords("Date,Description,Amount\n01/10/2026,Shop,-1"),
        { ...mapping, dateColumn: "Missing" },
        "household",
      ),
    ).toThrow("Mapped column"));
});
