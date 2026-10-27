import { expect, it } from "vitest";
import { csvRecords, parseRows } from "./parser.js";
import { suggestMapping } from "./mapping.js";
import { reconcileCsv } from "./balances.js";
const lines = [
  "14/03/2026,-20.01,Fictional shop,979.99",
  "14/03/2026,100,Fictional salary,1079.99",
  "16/03/2026,-5.52,Fictional cafe,1074.47",
];
it.each([false, true])(
  "recognises headerless amount and balance columns in either order (reverse %s)",
  (reverse) => {
    const records = csvRecords(
      (reverse ? [...lines].reverse() : lines).join("\n"),
      false,
    );
    const mapping = suggestMapping(records);
    expect(mapping).toMatchObject({
      amountColumn: "Column 2",
      balanceColumn: "Column 4",
    });
    expect(
      reconcileCsv(records, parseRows(records, mapping, "household"), mapping),
    ).toMatchObject({
      sourceRows: 3,
      from: "2026-03-14",
      to: "2026-03-16",
      bankOpeningCents: 100000,
      bankClosingCents: 107447,
      balanceVerified: true,
      netCents: 7447,
      warning: null,
    });
  },
);
it("flags missing rows, reversed signs and unreadable balances without discarding source rows", () => {
  const mapping = {
    ...suggestMapping(csvRecords(lines.join("\n"), false)),
    balanceColumn: "Column 4",
  };
  for (const csv of [
    [lines[0], lines[2]].join("\n"),
    lines.join("\n").replace("1079.99", "invalid"),
  ]) {
    const records = csvRecords(csv, false),
      rows = parseRows(records, mapping, "household");
    expect(reconcileCsv(records, rows, mapping)).toMatchObject({
      sourceRows: records.length,
      balanceVerified: false,
      warning: expect.any(String),
    });
  }
  const records = csvRecords(lines.join("\n"), false);
  expect(
    reconcileCsv(
      records,
      parseRows(records, { ...mapping, invertAmounts: true }, "household"),
      mapping,
    ).balanceVerified,
  ).toBe(false);
});
