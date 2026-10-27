import { mappingSchema, parseMoney, type Mapping } from "@finance/shared";
import { parseDate } from "./parser.js";

// Suggestions are deterministic and deliberately editable; ambiguous dates keep
// the Australian default. Never infer debit/credit direction from magnitude.
export function suggestMapping(
  records: Record<string, string>[],
  saved?: unknown,
): Mapping {
  const headers = Object.keys(records[0] ?? {});
  const sample = records.slice(0, 100);
  const find = (names: string[]) => {
    for (const name of names) {
      const header = headers.find(
        (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === name,
      );
      if (header) return header;
    }
    return "";
  };
  const formats = (column: string) => {
    const scores = (["DMY", "MDY", "ISO"] as const).map((format) => ({
      format,
      matches: sample.filter((row) => {
        try {
          parseDate(row[column] ?? "", format);
          return true;
        } catch {
          return false;
        }
      }).length,
    }));
    const best = Math.max(...scores.map((score) => score.matches));
    return scores
      .filter((score) => best > 0 && score.matches === best)
      .map((score) => score.format);
  };
  const dateColumn =
    find([
      "transactiondate",
      "date",
      "postingdate",
      "posteddate",
      "processdate",
      "valuedate",
    ]) ||
    headers.find((h) => formats(h).length) ||
    "";
  const descriptionColumn = find([
    "description",
    "transactiondescription",
    "narrative",
    "details",
    "transactiondetails",
    "merchant",
    "payee",
    "particulars",
    "memo",
  ]);
  const amountColumn = find([
    "amount",
    "transactionamount",
    "amountaud",
    "signedamount",
    "value",
  ]);
  const debitColumn = find([
    "debit",
    "debitamount",
    "withdrawal",
    "withdrawals",
    "moneyout",
    "paidout",
    "debits",
  ]);
  const creditColumn = find([
    "credit",
    "creditamount",
    "deposit",
    "deposits",
    "moneyin",
    "paidin",
    "credits",
  ]);
  const numeric = headers.filter(
    (h) =>
      h !== dateColumn &&
      sample.every((row) => {
        try {
          parseMoney(row[h] ?? "");
          return true;
        } catch {
          return false;
        }
      }),
  );
  const guessed: Mapping = {
    dateColumn,
    descriptionColumn,
    amountColumn,
    debitColumn,
    creditColumn,
    dateFormat: formats(dateColumn)[0] ?? "DMY",
  };
  if (headers.every((h) => /^Column \d+$/.test(h))) {
    // A balance or account number can also be numeric. Leave ambiguous amounts unmapped.
    if (numeric.length === 1) guessed.amountColumn = numeric[0]!;
    const text = headers.filter(
      (h) => h !== dateColumn && !numeric.includes(h),
    );
    if (text.length === 1) guessed.descriptionColumn = text[0]!;
  }
  const parsed = mappingSchema.safeParse(saved);
  if (parsed.success) {
    const mapping = parsed.data;
    const used = [
      mapping.dateColumn,
      mapping.descriptionColumn,
      ...(mapping.amountColumn
        ? [mapping.amountColumn]
        : [mapping.debitColumn, mapping.creditColumn]),
    ];
    if (
      used.every((h) => headers.includes(h)) &&
      formats(mapping.dateColumn).includes(mapping.dateFormat)
    )
      return mapping;
  }
  return guessed;
}
