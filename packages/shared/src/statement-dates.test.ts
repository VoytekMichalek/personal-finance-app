import { describe, expect, it } from "vitest";
import {
  statementDate,
  statementRowDateText,
  mergeStatementDateRepairs,
} from "./statement-dates.js";
import type { ImportRow } from "./types.js";
import type { StatementDetails } from "./statements.js";

describe("statement date recovery", () => {
  it("requires a year for partial dates and preserves printed years, leap days and day/month order", () => {
    expect(() => statementDate("12 Oct")).toThrow("Confirm the statement year");
    expect(statementDate("12 Oct", 2025)).toBe("2025-10-12");
    expect(statementDate("12/10", 2025)).toBe("2025-10-12");
    expect(statementDate("12/10/26", 2025)).toBe("2026-10-12");
    expect(statementDate("2026-10-12", 2025)).toBe("2026-10-12");
    expect(statementDate("29 Feb", 2024)).toBe("2024-02-29");
    expect(() => statementDate("29 Feb", 2025)).toThrow();
    expect(() => statementDate("31 Apr", 2026)).toThrow();
  });
  it("gets the date from that row's printed source, ignoring continuation references", () => {
    const details = {
      lines: [
        { rowNumber: 1, text: "12 Oct Grocery -20.00" },
        { rowNumber: 1, text: "card reference 01/02" },
        { rowNumber: 2, text: "13 Oct Other -10.00" },
      ],
    } as StatementDetails;
    expect(statementRowDateText(details, 1)).toBe("12 Oct");
    expect(statementRowDateText(details, 9)).toBeUndefined();
  });
  it("preserves review choices and resets stale matching choices only on corrected rows", () => {
    const current = [
      {
        rowNumber: 1,
        date: "",
        error: "Date is invalid",
        amountCents: -2000,
        description: "Edited description",
        categoryId: "chosen",
        categoryChosen: true,
        include: false,
        kind: "expense",
        linkExisting: { id: "stale", version: 1 },
      },
      {
        rowNumber: 2,
        date: "2026-01-01",
        error: null,
        include: false,
        categoryId: "keep",
      },
    ] as ImportRow[];
    const repaired = [
      {
        ...current[0]!,
        date: "2026-10-12",
        error: null,
        categoryId: null,
        description: "Source description",
        include: true,
        duplicate: false,
      },
      current[1]!,
    ];
    const result = mergeStatementDateRepairs(current, repaired);
    expect(result[0]).toMatchObject({
      date: "2026-10-12",
      error: null,
      include: true,
      amountCents: -2000,
      categoryId: "chosen",
      categoryChosen: true,
      description: "Edited description",
    });
    expect(result[0]!.linkExisting).toBeUndefined();
    expect(result[1]).toBe(current[1]);
    expect(current[0]!.date).toBe("");
  });
  it("uses a verified grouped posting date ahead of dates inside a description", () => {
    const details = {
      lines: [
        {
          rowNumber: 1,
          text: "01 Jan reference Cashback 0.20",
          dateText: "02 Jan",
        },
      ],
    } as StatementDetails;
    expect(statementRowDateText(details, 1)).toBe("02 Jan");
  });
});
