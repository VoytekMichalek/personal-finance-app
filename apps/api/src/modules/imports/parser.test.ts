import { describe, it, expect } from "vitest";
import { csvRecords, parseDate, parseRows } from "./parser.js";
const mapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: "Amount",
  debitColumn: "",
  creditColumn: "",
  dateFormat: "DMY" as const,
};
describe("bank CSV boundaries", () => {
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
