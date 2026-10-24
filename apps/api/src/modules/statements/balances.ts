import type { ImportRow, StatementDetails } from "@finance/shared";
import {
  openingLabel,
  closingLabel,
  statementLedgerAmount,
  statementMoneyPattern,
} from "./parser.js";
// Some cards print a row of headings followed by a row of values. Match columns,
// never borrow a minimum payment, credit limit or dated transaction amount.
export function recoverBalances(
  details: StatementDetails,
  rows: ImportRow[],
  accountType: string,
) {
  const dates = rows
    .map((r) => r.date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return;
  const onlyAmount = (text: string) => {
    const values = [...text.matchAll(statementMoneyPattern)];
    return values.length === 1 &&
      !text.replace(statementMoneyPattern, "").trim()
      ? statementLedgerAmount(values[0]![0], accountType)
      : null;
  };
  for (let i = 0; i < details.lines.length; i++) {
    const line = details.lines[i]!,
      next = details.lines[i + 1];
    for (const [key, pattern] of [
      ["opening", openingLabel],
      ["closing", closingLabel],
    ] as const) {
      if (details[key] || !pattern.test(line.text)) continue;
      const match = pattern.exec(line.text)!;
      const after = line.text.slice(match.index + match[0].length).trim();
      let amount = onlyAmount(after);
      let fromNext = false;
      if (
        amount === null &&
        next?.page === line.page &&
        next.line <= line.line + 2 &&
        !next.rowNumber
      ) {
        const headings = line.text.split(/\s{2,}/),
          values = next.text.split(/\s{2,}/);
        const column = headings.findIndex((heading) => pattern.test(heading));
        if (
          headings.length > 1 &&
          headings.length === values.length &&
          column >= 0
        )
          amount = onlyAmount(values[column]!);
        else if (line.text.trim() === match[0]) amount = onlyAmount(next.text);
        fromNext = amount !== null;
      }
      if (amount !== null) {
        details[key] = {
          date: key === "opening" ? dates[0]! : dates.at(-1)!,
          amountCents: amount,
        };
        line.status = "context";
        if (fromNext && next) next.status = "context";
      }
    }
  }
  if (!details.lines.some((line) => line.status === "review"))
    details.warnings = details.warnings.filter(
      (w) => !/some source lines need review/i.test(w),
    );
  if (details.opening)
    details.warnings = details.warnings.filter(
      (w) =>
        !/opening balance.*not identified|no verified opening balance/i.test(w),
    );
  if (
    details.opening &&
    details.closing &&
    details.opening.amountCents +
      rows.reduce((sum, row) => sum + row.amountCents, 0) !==
      details.closing.amountCents &&
    !details.warnings.some((w) => /reconcile|does not match/i.test(w))
  )
    details.warnings.push(
      "The extracted transactions do not reconcile to the closing balance. Check for missing or misread lines before importing.",
    );
}
