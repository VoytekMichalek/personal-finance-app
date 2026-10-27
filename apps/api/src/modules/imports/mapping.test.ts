import { describe, it, expect } from "vitest";
import { mappingSchema } from "@finance/shared";
import { suggestMapping } from "./mapping.js";
import { csvRecords, parseRows } from "./parser.js";

describe("CSV mapping suggestions", () => {
  it.each([",", ";", "\t"])(
    "recognises split columns and ISO dates with delimiter %j",
    (delimiter) => {
      const records = csvRecords(
        [
          ["Transaction Date", "Details", "Money Out", "Money In", "Balance"],
          ["2026-10-01", "Shop", "19.99", "", "100"],
          ["2026-10-02", "Salary", "", "50.01", "150.01"],
        ]
          .map((row) => row.join(delimiter))
          .join("\n"),
      );
      const mapping = suggestMapping(records);
      expect(mapping).toMatchObject({
        dateColumn: "Transaction Date",
        descriptionColumn: "Details",
        amountColumn: "",
        debitColumn: "Money Out",
        creditColumn: "Money In",
        dateFormat: "ISO",
      });
      expect(
        parseRows(records, mapping, "household").map((r) => r.amountCents),
      ).toEqual([-1999, 5001]);
    },
  );
  it("chooses unambiguous US dates but defaults ambiguous dates to DMY", () => {
    expect(
      suggestMapping(csvRecords("Date,Payee,Amount\n10/21/2026,Shop,-2"))
        .dateFormat,
    ).toBe("MDY");
    expect(
      suggestMapping(csvRecords("Date,Payee,Amount\n03/04/2026,Shop,-2"))
        .dateFormat,
    ).toBe("DMY");
  });
  it("still suggests the best date format when a source row needs correction", () => {
    expect(
      suggestMapping(
        csvRecords("Date,Details,Amount\n2026-10-01,Shop,-2\ninvalid,Train,-1"),
      ).dateFormat,
    ).toBe("ISO");
  });
  it("reuses compatible saved mappings, including chosen signs and ambiguous dates", () => {
    const records = csvRecords("Date,Details,Amount\n03/04/2026,Shop,2");
    const saved = {
      ...suggestMapping(records),
      dateFormat: "MDY",
      invertAmounts: true,
    };
    expect(suggestMapping(records, saved)).toEqual(saved);
    expect(
      suggestMapping(records, { ...saved, amountColumn: "Old amount" }),
    ).toMatchObject({ amountColumn: "Amount", dateFormat: "DMY" });
    expect(
      suggestMapping(records, { ...saved, dateFormat: "ISO" }).dateFormat,
    ).toBe("DMY");
  });
  it("preserves the first headerless transaction and leaves ambiguous numeric columns for review", () => {
    const records = csvRecords(
      "01/10/2026,-19.99,Shop\n02/10/2026,2000,Salary",
      false,
    );
    const mapping = suggestMapping(records);
    expect(mapping).toMatchObject({
      dateColumn: "Column 1",
      amountColumn: "Column 2",
      descriptionColumn: "Column 3",
    });
    expect(parseRows(records, mapping, "household")).toHaveLength(2);
    expect(
      suggestMapping(csvRecords("01/10/2026,-19.99,Shop,100", false))
        .amountColumn,
    ).toBe("");
  });
  it("rejects assigning the same source column to multiple fields", () => {
    const mapping = suggestMapping(
      csvRecords("Date,Description,Amount\n01/10/2026,Shop,-2"),
    );
    expect(
      mappingSchema.safeParse({ ...mapping, amountColumn: "Date" }).success,
    ).toBe(false);
  });
});
