import { date as dateSchema } from "./schemas.js";
import type { StatementDetails } from "./statements.js";
import type { ImportRow } from "./types.js";

export const statementDatePattern =
  /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}[\s-]+[A-Za-z]{3,9}(?:[\s-]+\d{4})?)\b/;
const months = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function statementDate(text: string, year?: number) {
  if (/^\d{4}-/.test(text)) return dateSchema.parse(text);
  const parts = text.trim().split(/[\s/-]+/);
  const month = /^\d+$/.test(parts[1] ?? "")
    ? Number(parts[1])
    : months.indexOf((parts[1] ?? "").slice(0, 3).toLowerCase()) + 1;
  const y = parts[2]
    ? Number(parts[2]) + (parts[2].length === 2 ? 2000 : 0)
    : year;
  if (!y)
    throw new Error("Confirm the statement year to read dates without a year.");
  return dateSchema.parse(
    `${y}-${String(month).padStart(2, "0")}-${(parts[0] ?? "").padStart(2, "0")}`,
  );
}

export function statementRowDateText(
  details: StatementDetails,
  rowNumber: number,
) {
  return details.lines
    .filter((line) => line.rowNumber === rowNumber)
    .map(
      (line) =>
        line.dateText || line.text.trim().match(statementDatePattern)?.[1],
    )
    .find((text): text is string => !!text);
}

export const hasStatementDateError = (row: ImportRow) =>
  !!row.error && /date|year|future transactions/i.test(row.error);

/** Keep reviewed choices while adopting only the server-verified date repair. */
export function mergeStatementDateRepairs(
  current: ImportRow[],
  repaired: ImportRow[],
) {
  const sources = new Map(repaired.map((row) => [row.rowNumber, row]));
  return current.map((row) => {
    const source = sources.get(row.rowNumber);
    if (!source || (source.date === row.date && source.error === row.error))
      return row;
    return {
      ...row,
      date: source.date,
      error: source.error,
      duplicate: source.duplicate,
      include: row.error ? source.include : row.include,
      allowDuplicate: false,
      linkExisting: undefined,
      reconcileExisting: undefined,
    };
  });
}
