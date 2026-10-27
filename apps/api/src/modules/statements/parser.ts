import {
  date as dateSchema,
  parseMoney,
  type ImportRow,
  type StatementDetails,
} from "@finance/shared";
export const statementMoneyPattern =
  /(?:[-+]?\$?\(?\d[\d,]*\.\d{2}\)?(?:\s?(?:CR|DR))?)/gi;
export const openingLabel =
  /opening balance|previous (?:statement )?balance|last statement balance|balance (?:brought forward|b\/f|(?:at|from) (?:the )?(?:last|previous) statement)|beginning balance/i;
export const closingLabel =
  /closing balance|new balance|balance carried forward|balance c\/f|ending balance/i;
const datePattern =
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
export function statementAmount(text: string) {
  const negative = /DR|\(|^-/.test(text.toUpperCase());
  const value = parseMoney(text.replace(/CR|DR|[()$+\s-]/gi, ""));
  return negative ? -value : value;
}
// Card statements express an unsigned balance as money owed, and CR as credit.
export function statementLedgerAmount(text: string, accountType = "bank") {
  const amount = statementAmount(text);
  return accountType === "credit" && !/CR|DR/i.test(text) ? -amount : amount;
}
export function statementDate(text: string, year?: number) {
  if (/^\d{4}-/.test(text)) return dateSchema.parse(text);
  const parts = text.trim().split(/[\s/-]+/);
  const month = /^\d+$/.test(parts[1]!)
    ? Number(parts[1])
    : months.indexOf(parts[1]!.slice(0, 3).toLowerCase()) + 1;
  const y = parts[2]
    ? Number(parts[2]) + (parts[2].length === 2 ? 2000 : 0)
    : year;
  if (!y)
    throw new Error("Confirm the statement year to read dates without a year.");
  return dateSchema.parse(
    `${y}-${String(month).padStart(2, "0")}-${parts[0]!.padStart(2, "0")}`,
  );
}
export function parseStatement(
  pages: string[],
  owner: string,
  year?: number,
  accountType = "bank",
) {
  const amount = (text: string) => statementLedgerAmount(text, accountType);
  const rows: ImportRow[] = [];
  const details: StatementDetails = {
    lines: [],
    opening: null,
    closing: null,
    warnings: [],
    recurring: [],
  };
  // Infer a year only when the document has exactly one distinct year.
  const years = [...new Set(pages.join("\n").match(/\b20\d{2}\b/g))];
  const inferredYear =
    year ?? (years.length === 1 ? Number(years[0]) : undefined);
  let balance: number | null = null;
  let openingAmount: number | null = null;
  let closingAmount: number | null = null;
  let pendingBalance: "opening" | "closing" | null = null;
  let hasBalanceColumn = false;
  let tableYear: number | undefined;
  let debitAt = -1,
    creditAt = -1;
  for (const [pageIndex, page] of pages.entries()) {
    let descriptionAt = -1,
      amountsAt = -1,
      hasProcessedDate = false;
    let previousRow: ImportRow | undefined;
    for (const [lineIndex, raw] of page.split(/\r?\n/).entries()) {
      const text = raw.trim();
      if (!text) continue;
      const source: StatementDetails["lines"][number] = {
        page: pageIndex + 1,
        line: lineIndex + 1,
        text,
        rowNumber: null,
        status: "context",
      };
      details.lines.push(source);
      if (
        /\bdate\b/i.test(text) &&
        /description|details|transaction|debit|credit/i.test(text)
      ) {
        hasBalanceColumn = /balance/i.test(text);
        debitAt = raw.search(/withdrawals?|debits?|money out|paid out/i);
        creditAt = raw.search(/deposits?|credits?|money in|paid in/i);
        descriptionAt = raw.search(/description|details/i);
        amountsAt = raw.search(
          /withdrawals?|debits?|money out|paid out|deposits?|credits?|money in|paid in|amount/i,
        );
        hasProcessedDate = /\bprocessed\b/i.test(text);
        previousRow = undefined;
        continue;
      }
      // A printed year in the date column takes precedence over the fallback
      // year. Keep it across pages until the next heading, including New Year.
      if (
        descriptionAt >= 0 &&
        /^20\d{2}$/.test(text) &&
        raw.search(/\S/) < descriptionAt
      ) {
        tableYear = Number(text);
        previousRow = undefined;
        continue;
      }
      const values = [...raw.matchAll(statementMoneyPattern)];
      if (
        pendingBalance &&
        values.length === 1 &&
        text.replace(statementMoneyPattern, "").trim() === ""
      ) {
        if (pendingBalance === "opening") {
          openingAmount ??= amount(values[0]![0]);
          balance = openingAmount;
        } else closingAmount = amount(values[0]![0]);
        pendingBalance = null;
        continue;
      }
      pendingBalance = !values.length
        ? openingLabel.test(text)
          ? "opening"
          : closingLabel.test(text)
            ? "closing"
            : null
        : null;
      if (openingLabel.test(text) && values.length) {
        openingAmount ??= amount(values.at(-1)![0]);
        balance = amount(values.at(-1)![0]);
        continue;
      }
      if (closingLabel.test(text) && values.length) {
        closingAmount = amount(values.at(-1)![0]);
        continue;
      }
      const start = raw.search(/\S/);
      // Only join text aligned within the description column. This keeps
      // page footers, summaries and unrecognised monetary lines separate,
      // including references that happen to resemble a date or an amount.
      if (
        previousRow &&
        descriptionAt >= 0 &&
        amountsAt > descriptionAt &&
        Math.abs(start - descriptionAt) <= 2 &&
        raw.trimEnd().length <= amountsAt + 2
      ) {
        const joined = `${previousRow.description} ${text}`;
        previousRow.description = joined.slice(0, 250);
        if (joined.length > 250) {
          previousRow.error =
            "Description is too long. Check the source lines.";
          previousRow.include = false;
        }
        source.rowNumber = previousRow.rowNumber;
        source.status = previousRow.error ? "review" : "transaction";
        continue;
      }
      const match = text.match(datePattern);
      if (!match) {
        previousRow = undefined;
        if (
          values.length &&
          !/total|balance|interest rate|page\s+\d|account number|bsb/i.test(
            text,
          )
        )
          source.status = "review";
        continue;
      }
      if (!values.length) {
        previousRow = undefined;
        const remaining = text.slice(match[0].length).trim();
        const endDate = remaining.replace(/^(?:-|to)\s+/i, "");
        if (
          remaining === endDate ||
          endDate.match(datePattern)?.[0] !== endDate
        )
          source.status = "review";
        continue;
      }
      let posted = "",
        error: string | null = null;
      try {
        posted = statementDate(match[1]!, tableYear ?? inferredYear);
      } catch {
        error =
          "Date is ambiguous or invalid. Check the source line and statement year.";
      }
      const transactionValues =
        hasProcessedDate && amountsAt > descriptionAt
          ? values.filter((entry) => entry.index >= amountsAt - 2)
          : values;
      const first = transactionValues[0];
      if (!first) {
        source.status = "review";
        previousRow = undefined;
        continue;
      }
      let description = raw
        .slice(raw.indexOf(match[1]!) + match[1]!.length, first.index)
        .trim();
      if (hasProcessedDate) {
        const processed = description.match(datePattern);
        if (processed)
          description = description.slice(processed[0].length).trim();
      }
      let value = amount(first[0]);
      const ending =
        hasBalanceColumn && transactionValues.length >= 2
          ? amount(transactionValues.at(-1)![0])
          : null;
      if (ending !== null && balance !== null) {
        const delta = ending - balance;
        if (Math.abs(delta) === Math.abs(value)) value = delta;
        else error = "Running balance does not reconcile. Check this line.";
      } else if (!/[-+()]|CR|DR/i.test(first[0])) {
        if (debitAt >= 0 && creditAt >= 0) {
          const right = (first.index ?? 0) + first[0].length;
          // Amounts are right aligned under their debit/credit column headings.
          const debitDistance = Math.abs(right - (debitAt + 10));
          const creditDistance = Math.abs(right - (creditAt + 10));
          if (Math.abs(debitDistance - creditDistance) < 4)
            error = "Debit/credit direction is ambiguous.";
          else
            value =
              debitDistance < creditDistance
                ? -Math.abs(value)
                : Math.abs(value);
        } else if (
          accountType !== "credit" ||
          /payment received|repayment|refund|reversal|cashback/i.test(
            description,
          )
        )
          error =
            "Cannot determine debit or credit safely. Use a statement with running balances or signed amounts.";
      }
      if (ending !== null) balance = ending;
      if (hasProcessedDate && hasBalanceColumn && transactionValues.length < 2)
        error =
          "Transaction amount or running balance is missing. Check this line.";
      if (!description || description.length > 250 || !value)
        error = "Transaction needs a description and a nonzero amount.";
      const row: ImportRow = {
        rowNumber: rows.length + 1,
        date: posted,
        description: description.slice(0, 250),
        amountCents: value,
        kind: value < 0 ? "expense" : "income",
        counterAccountId: null,
        categoryId: null,
        owner,
        include: !error,
        allowDuplicate: false,
        duplicate: false,
        error,
      };
      rows.push(row);
      previousRow = row;
      source.rowNumber = row.rowNumber;
      source.status = error ? "review" : "transaction";
    }
  }
  const dated = rows
    .filter((r) => r.date)
    .map((r) => r.date)
    .sort();
  if (openingAmount !== null && dated[0])
    details.opening = { date: dated[0], amountCents: openingAmount };
  if (closingAmount !== null && dated.at(-1))
    details.closing = { date: dated.at(-1)!, amountCents: closingAmount };
  if (!details.opening)
    details.warnings.push(
      "Opening balance was not identified. Confirm it against the statement before importing.",
    );
  if (
    details.opening &&
    details.closing &&
    details.opening.amountCents +
      rows.reduce((sum, row) => sum + row.amountCents, 0) !==
      details.closing.amountCents
  )
    details.warnings.push(
      "Opening balance plus extracted transactions does not match the closing balance. Review all pages for missing or misread entries.",
    );
  if (details.lines.some((l) => l.status === "review"))
    details.warnings.push(
      "Some source lines need review. No unrecognised line is silently treated as a transaction.",
    );
  if (!rows.length)
    details.warnings.push(
      "No transactions could be confidently extracted from this layout.",
    );
  if (rows.length > 10000)
    throw new Error("Upload up to 10,000 statement transactions at a time.");
  return { rows, details };
}
