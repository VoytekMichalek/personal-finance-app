import {
  statementDate,
  type ImportRow,
  type StatementDetails,
} from "@finance/shared";
import { HttpError } from "../../lib/errors.js";
import { statementAmount } from "./amounts.js";

const heading =
  /Date\s+Transaction Details\s+Debits\/Withdrawals\s+Credits\/Deposits\s+Balance/i;
const money = /^\d[\d,]*\.\d{2}(?:\s*(?:CR|DR))?$/i;

// HSBC leaves posting dates blank within a group and prints balances only at
// checkpoints. Read actual columns, never dates/references inside descriptions.
export function parseHsbcStatement(
  pages: string[],
  owner: string,
  year?: number,
  accountType = "bank",
) {
  if (
    accountType !== "bank" ||
    !pages.some((page) => /HSBC Bank Australia/i.test(page)) ||
    !pages.some((page) => heading.test(page))
  )
    return null;
  const text = pages.join("\n");
  const accounts = [...text.matchAll(/\bAccount\s+(\d+)/gi)].map(
    (match) => match[1],
  );
  const currencies = [...text.matchAll(/\bCurrency\s+([A-Z]{3})/g)].map(
    (match) => match[1],
  );
  if (
    new Set(accounts).size > 1 ||
    currencies.some((currency) => currency !== "AUD")
  )
    throw new HttpError(
      422,
      "This HSBC PDF contains multiple accounts or a non-AUD account. Export a statement for just this AUD account, or use its CSV export.",
    );
  const endText = text.match(
    /statement period\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
  )?.[1];
  const end = endText ? statementDate(endText) : undefined;
  const years = [...new Set(text.match(/\b20\d{2}\b/g))];
  const fallbackYear =
    year ?? (years.length === 1 ? Number(years[0]) : undefined);
  const date = (printed: string) => {
    let result = statementDate(
      printed,
      year ?? (end ? Number(end.slice(0, 4)) : fallbackYear),
    );
    if (!year && end && result > end)
      result = statementDate(printed, Number(end.slice(0, 4)) - 1);
    return result;
  };
  const rows: ImportRow[] = [];
  const details: StatementDetails = {
    lines: [],
    opening: null,
    closing: null,
    warnings: [],
    recurring: [],
  };
  let posting = "",
    posted = "",
    dateError = false;
  let running: number | null = null;
  let previous: ImportRow | undefined;
  let checkpoint = 0;
  let opened = false,
    closed = false;
  let debitTotal = 0,
    creditTotal = 0,
    debitCount = 0,
    creditCount = 0;
  const fail = (from: number, message: string) => {
    for (const row of rows.slice(from)) {
      row.error = message;
      row.include = false;
    }
  };
  for (const [p, page] of pages.entries()) {
    let columns:
      | { description: number; debit: number; credit: number; balance: number }
      | undefined;
    // Only explicitly continued account pages may inherit a description/date.
    if (p && !/A\/C\s+continued/i.test(page)) {
      previous = undefined;
      posting = "";
      posted = "";
    }
    for (const [l, raw] of page.split(/\r?\n/).entries()) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const source: StatementDetails["lines"][number] = {
        page: p + 1,
        line: l + 1,
        text: trimmed,
        rowNumber: null,
        status: "context",
      };
      details.lines.push(source);
      if (heading.test(raw)) {
        columns = {
          description: raw.search(/Transaction Details/i),
          debit: raw.search(/Debits\/Withdrawals/i),
          credit: raw.search(/Credits\/Deposits/i),
          balance: raw.search(/Balance\s*$/i),
        };
        continue;
      }
      if (/^Important Information|^END OF STATEMENT/i.test(trimmed)) {
        columns = undefined;
        continue;
      }
      if (!columns) continue;
      const { description: d, debit: a, credit: b, balance: c } = columns;
      const printed = raw.slice(0, d).trim();
      const description = raw.slice(d, a).trim();
      const cells = [
        raw.slice(a, b).trim(),
        raw.slice(b, c).trim(),
        raw.slice(c).trim(),
      ];
      const values = cells.map((cell) =>
        money.test(cell) ? statementAmount(cell) : null,
      );
      const [debit, credit, balance] = values;
      if (/^Transaction (Total|Number)$/i.test(description)) {
        const expected = /Total/i.test(description)
          ? [debitTotal, creditTotal]
          : [debitCount, creditCount];
        const actual = /Total/i.test(description)
          ? values.slice(0, 2)
          : cells
              .slice(0, 2)
              .map((cell) => (/^\d+$/.test(cell) ? Number(cell) : null));
        if (actual.some((value, index) => value !== expected[index])) {
          source.status = "review";
          details.warnings.push(
            "The HSBC transaction totals or counts do not match. Compare all source pages and read again or use a CSV export before importing.",
          );
          fail(
            0,
            "Statement totals or counts do not reconcile. Check the source PDF and read again.",
          );
        }
        previous = undefined;
        continue;
      }
      if (/^BALANCE BROUGHT FORWARD$/i.test(description) && opened)
        throw new HttpError(
          422,
          "This HSBC PDF starts another account section. Export a statement for one account or use its CSV export.",
        );
      if (closed) continue;
      if (printed) {
        posting = printed;
        try {
          posted = date(printed);
          dateError = false;
        } catch {
          posted = "";
          dateError = true;
        }
      }
      if (/^BALANCE BROUGHT FORWARD$|^CLOSING BALANCE$/i.test(description)) {
        const opening = /^BALANCE BROUGHT/i.test(description);
        if (balance === null || balance === undefined || !posted)
          source.status = "review";
        else if (opening) {
          details.opening = { date: posted, amountCents: balance };
          running = balance;
        } else {
          details.closing = { date: posted, amountCents: balance };
          if (running !== null && running !== balance)
            fail(
              checkpoint,
              "Running balance does not reconcile. Check the source PDF and read again.",
            );
        }
        if (opening) opened = true;
        else closed = true;
        previous = undefined;
        continue;
      }
      // A vertical printer reference can sit outside the table at a page edge.
      if (
        !printed &&
        !description &&
        cells.slice(0, 2).every((cell) => !cell) &&
        balance == null
      )
        continue;
      if (!printed && description && cells.every((cell) => !cell)) {
        if (previous && Math.abs(raw.search(/\S/) - d) <= 2) {
          const joined = `${previous.description} ${description}`;
          previous.description = joined.slice(0, 250);
          if (joined.length > 250) {
            previous.error =
              "Description is too long. Check the source lines and shorten it.";
            previous.include = false;
          }
          source.rowNumber = previous.rowNumber;
        } else source.status = "review";
        continue;
      }
      const valid = cells.every(
        (cell, index) => !cell || values[index] !== null,
      );
      if (!valid || (debit == null) === (credit == null) || !description) {
        source.status = "review";
        previous = undefined;
        continue;
      }
      const amountCents = credit ?? -debit!;
      if (amountCents < 0) {
        debitTotal -= amountCents;
        debitCount++;
      } else {
        creditTotal += amountCents;
        creditCount++;
      }
      const error =
        !posting || dateError
          ? "Date is ambiguous or invalid. Check the source date and statement year."
          : !amountCents ||
              (debit !== null && debit! < 0) ||
              (credit !== null && credit! < 0)
            ? "Transaction amount is invalid. Check the source PDF and read again."
            : description.length > 250
              ? "Description is too long. Check the source lines and shorten it."
              : null;
      const row: ImportRow = {
        rowNumber: rows.length + 1,
        date: posted,
        description: description.slice(0, 250),
        amountCents,
        kind: amountCents < 0 ? "expense" : "income",
        counterAccountId: null,
        categoryId: null,
        owner,
        include: !error,
        allowDuplicate: false,
        duplicate: false,
        error,
      };
      rows.push(row);
      source.rowNumber = row.rowNumber;
      source.dateText = posting;
      previous = row;
      if (running !== null) running += amountCents;
      if (balance != null) {
        if (running !== null && balance !== running)
          fail(
            checkpoint,
            "Running balance does not reconcile. Check the source PDF and read again.",
          );
        running = balance;
        checkpoint = rows.length;
      }
    }
  }
  for (const source of details.lines) {
    if (source.rowNumber)
      source.status = rows[source.rowNumber - 1]!.error
        ? "review"
        : "transaction";
  }
  if (!details.opening)
    details.warnings.push(
      "Opening balance was not identified. Confirm it against the statement before importing.",
    );
  if (!details.closing)
    details.warnings.push(
      "Closing balance was not identified. Check that every statement page is present before importing.",
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
  if (details.lines.some((line) => line.status === "review"))
    details.warnings.push(
      "Some source lines need review. Compare the PDF and read again or use a CSV export for unreadable entries.",
    );
  if (rows.length > 10000)
    throw new HttpError(
      400,
      "Upload up to 10,000 statement transactions at a time.",
    );
  return { rows, details };
}
