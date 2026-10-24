import { parse } from "csv-parse/sync";
import {
  date as dateSchema,
  parseMoney,
  type ImportRow,
  type Mapping,
} from "@finance/shared";
import { HttpError } from "../../lib/errors.js";
export function csvRecords(csv: string): Record<string, string>[] {
  try {
    const rows = parse(csv, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: csv.split("\n")[0]?.includes(";") ? ";" : ",",
      max_record_size: 10000,
    }) as Record<string, string>[];
    if (rows.length > 10000)
      throw new HttpError(400, "Import up to 10,000 rows at a time.");
    return rows;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "CSV could not be read. Check its delimiters and column headers.",
    );
  }
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
        row.amountCents = parseMoney(record[mapping.amountColumn] ?? "");
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
