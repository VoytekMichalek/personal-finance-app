import { parse } from "csv-parse/sync";
import {
  date as dateSchema,
  parseMoney,
  type ImportRow,
  type Mapping,
} from "@finance/shared";
import { HttpError } from "../../lib/errors.js";
export function readCsv(
  csv: string,
  hasHeaders?: boolean,
): { rows: Record<string, string>[]; hasHeaders: boolean } {
  try {
    // Parse candidate delimiters properly: punctuation inside quoted fields is data.
    const candidates: string[][][] = [];
    for (const delimiter of [",", ";", "\t"]) {
      try {
        const records = parse(csv, {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          delimiter,
          max_record_size: 10000,
        }) as string[][];
        if ((records[0]?.length ?? 0) >= 3) candidates.push(records);
      } catch {
        /* Try the remaining supported delimiters. */
      }
    }
    const records = candidates.sort((a, b) => b[0]!.length - a[0]!.length)[0];
    if (!records) throw new Error("No readable columns");
    const first = records[0]!;
    const dateIndex = first.findIndex((cell) =>
      (["DMY", "MDY", "ISO"] as const).some((format) => {
        try {
          parseDate(cell, format);
          return true;
        } catch {
          return false;
        }
      }),
    );
    const hasMoney = first.some((cell, index) => {
      if (index === dateIndex) return false;
      try {
        parseMoney(cell);
        return true;
      } catch {
        return false;
      }
    });
    const headerRow = hasHeaders ?? !(dateIndex >= 0 && hasMoney);
    const headers = headerRow
      ? records.shift()!.map((header) => header.trim())
      : records[0]!.map((_, index) => "Column " + (index + 1));
    if (
      headers.some((header) => !header) ||
      new Set(headers).size !== headers.length
    )
      throw new HttpError(
        400,
        "CSV column headers must be non-empty and unique. If there are no headers, turn off ‘First row contains column names’.",
      );
    if (!records.length)
      throw new HttpError(400, "This CSV has no transaction rows.");
    if (records.length > 10000)
      throw new HttpError(400, "Import up to 10,000 rows at a time.");
    const rows = records.map((record) =>
      Object.fromEntries(
        headers.map((header, index) => [header, record[index]!]),
      ),
    );
    return { rows, hasHeaders: headerRow };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "CSV could not be read. Check its delimiters and column headers.",
    );
  }
}
export function csvRecords(
  csv: string,
  hasHeaders = true,
): Record<string, string>[] {
  return readCsv(csv, hasHeaders).rows;
}
export function parseDate(
  value: string,
  format: Mapping["dateFormat"],
): string {
  if (format === "ISO") return dateSchema.parse(value.slice(0, 10));
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) throw new Error("Date does not match the selected format.");
  const first = match[1]!;
  const second = match[2]!;
  return dateSchema.parse(
    match[3] +
      "-" +
      (format === "DMY" ? second : first).padStart(2, "0") +
      "-" +
      (format === "DMY" ? first : second).padStart(2, "0"),
  );
}
export function parseRows(
  records: Record<string, string>[],
  mapping: Mapping,
  owner: string,
): ImportRow[] {
  const headers = Object.keys(records[0] ?? {});
  for (const column of [
    mapping.dateColumn,
    mapping.descriptionColumn,
    ...(mapping.amountColumn
      ? [mapping.amountColumn]
      : [mapping.debitColumn, mapping.creditColumn]),
  ])
    if (!headers.includes(column))
      throw new HttpError(400, "Mapped column not found: " + column);
  return records.map((record, index) => {
    const row: ImportRow = {
      kind: "expense",
      counterAccountId: null,
      rowNumber: index + 1,
      date: "",
      description: record[mapping.descriptionColumn]?.trim() ?? "",
      amountCents: 0,
      categoryId: null,
      owner,
      include: true,
      allowDuplicate: false,
      duplicate: false,
      error: null,
    };
    try {
      row.date = parseDate(
        record[mapping.dateColumn] ?? "",
        mapping.dateFormat,
      );
      if (mapping.amountColumn)
        row.amountCents =
          parseMoney(record[mapping.amountColumn] ?? "") *
          (mapping.invertAmounts ? -1 : 1);
      else {
        const debit = parseMoney(record[mapping.debitColumn] || "0");
        const credit = parseMoney(record[mapping.creditColumn] || "0");
        if (debit && credit)
          throw new Error("Both debit and credit are populated.");
        if (debit < 0 || credit < 0)
          throw new Error("Debit and credit columns must be positive.");
        row.amountCents = credit - debit;
      }
      row.kind = row.amountCents > 0 ? "income" : "expense";
      if (!row.description || row.description.length > 250 || !row.amountCents)
        throw new Error("Each row needs a description and nonzero amount.");
    } catch (error) {
      row.error = error instanceof Error ? error.message : "Invalid row";
      row.include = false;
    }
    return row;
  });
}
