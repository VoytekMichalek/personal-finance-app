import {
  statementDate,
  type ImportRow,
  type StatementDetails,
} from "@finance/shared";
import { HttpError } from "../../lib/errors.js";
import { statementAmount } from "./amounts.js";

type Source = StatementDetails["lines"][number];
const posted = /^\s*\d{4}\s+(\d{2}-\d{2}-\d{4})\s+/;
const currencyAmount = /^([+-]?\d[\d,]*\.\d{2})\s+([A-Z]{3})$/;
type Money = { amount: number; currency: string };
function money(text: string): Money | null {
  const match = text.trim().match(currencyAmount);
  return match
    ? { amount: statementAmount(match[1]!), currency: match[2]! }
    : null;
}
type Entry = {
  dateText: string;
  type: string;
  merchant: string[];
  original: Money | null;
  sources: Source[];
  settlements: { value: Money; source: Source }[];
};

// Qantas Pay is a prepaid wallet: the merchant currency and the debited wallet
// currency are different evidence. Exchange-rate numbers are never money.
export function parseQantasStatement(
  pages: string[],
  owner: string,
  accountType = "bank",
) {
  const text = pages.join("\n");
  if (
    !/Qantas\s*(?:Pay|Money)|qantaspay\.qantasmoney/i.test(text) ||
    !/Merchant Currency\s+Multi-Currency/i.test(text) ||
    !/Transaction Description\s+Merchant Name\s*\/\s*Address/i.test(text)
  )
    return null;
  if (accountType === "credit")
    throw new HttpError(
      422,
      "Qantas Pay is a prepaid wallet. Choose a bank account for its AUD balance, then upload this PDF again.",
    );
  const rows: ImportRow[] = [];
  const details: StatementDetails = {
    lines: [],
    opening: null,
    closing: null,
    warnings: [],
    recurring: [],
  };
  const warn = (message: string) => {
    if (!details.warnings.includes(message)) details.warnings.push(message);
  };
  const period = text.match(
    /Statement for Period\s+(\d{1,2} \w+ \d{4})\s+to\s+(\d{1,2} \w+ \d{4})/i,
  );
  let start: string | undefined, end: string | undefined;
  try {
    if (period) {
      start = statementDate(period[1]!);
      end = statementDate(period[2]!);
    }
  } catch {
    /* Keep dates on the actual transaction rows available for review. */
  }
  let opening: number | null = null,
    closing: number | null = null;
  let balanceSection: "opening" | "closing" | null = null;
  let entry: Entry | undefined;
  let prefix: { text: string; source: Source }[] = [];
  const orphan = (source: Source) => {
    source.status = "review";
    warn(
      `Qantas Pay amount on page ${source.page}, line ${source.line} has no matching dated transaction. Check Source & reading notes and download the PDF; use a corrected statement or CSV for the missing entry. Its date and merchant have not been guessed.`,
    );
  };
  const finish = () => {
    if (!entry) return;
    const current = entry;
    entry = undefined;
    const aud = current.settlements.filter(
      ({ value }) => value.currency === "AUD",
    );
    // Prefer a matching AUD settlement; an unrelated exchange line must not
    // overwrite a dated AUD purchase or create a transaction of its own.
    const settlement =
      current.original?.currency === "AUD"
        ? aud.find(({ value }) => value.amount === current.original!.amount)
        : aud.length === 1
          ? aud[0]
          : undefined;
    const foreignWallet = current.settlements.some(
      ({ value }) => value.currency !== "AUD",
    );
    const amount = foreignWallet
      ? null
      : (settlement?.value.amount ??
        (!foreignWallet && current.original?.currency === "AUD"
          ? current.original.amount
          : null));
    for (const item of current.settlements) {
      if (item === settlement) current.sources.push(item.source);
      else orphan(item.source);
    }
    if (amount === null || !current.original) {
      current.sources.forEach((source) => {
        source.status = "review";
      });
      warn(
        "Some Qantas Pay entries have no unambiguous AUD wallet amount. Review the highlighted source lines; use an AUD statement or CSV for those entries. Foreign-currency amounts are not imported as AUD.",
      );
      return;
    }
    let date = "",
      error: string | null = null;
    try {
      date = statementDate(current.dateText);
    } catch {
      error =
        "Date is invalid. Check the source PDF and read again with a corrected statement.";
    }
    if (Math.sign(amount) !== Math.sign(current.original.amount))
      error =
        "Merchant and AUD wallet amounts have different signs. Check the source PDF and read again with a corrected statement or CSV.";
    const description = [current.type, ...current.merchant]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (
      !current.type ||
      !current.merchant.length ||
      !amount ||
      description.length > 250
    )
      error =
        "Transaction description or amount is incomplete. Check the source PDF and read again, or use its CSV export.";
    const row: ImportRow = {
      rowNumber: rows.length + 1,
      date,
      description: description.slice(0, 250),
      amountCents: amount,
      kind:
        amount < 0
          ? "expense"
          : /CREDIT VOUCHER|REFUND|REVERSAL/i.test(current.type)
            ? "refund"
            : /PREPAID RELOAD/i.test(current.type)
              ? "transfer"
              : "income",
      owner,
      categoryId: null,
      counterAccountId: null,
      include: !error,
      allowDuplicate: false,
      duplicate: false,
      error,
    };
    rows.push(row);
    for (const source of current.sources) {
      source.rowNumber = row.rowNumber;
      source.dateText = current.dateText;
      source.status = error ? "review" : "transaction";
    }
  };
  for (const [pageIndex, page] of pages.entries()) {
    let merchantAt = -1,
      amountAt = -1,
      inTable = false;
    const rawLines = page.split(/\r?\n/);
    for (const [lineIndex, raw] of rawLines.entries()) {
      const value = raw.trim();
      if (!value) continue;
      const source: Source = {
        page: pageIndex + 1,
        line: lineIndex + 1,
        text: value,
        rowNumber: null,
        status: "context",
      };
      details.lines.push(source);
      if (/^(Opening|Closing) Balance for Period/i.test(value)) {
        balanceSection = /^Opening/i.test(value) ? "opening" : "closing";
        continue;
      }
      if (balanceSection) {
        const aud = raw.match(/(?:^|\s)([+-]?\d[\d,]*\.\d{2})\s+AUD\b/);
        if (aud) {
          if (balanceSection === "opening") opening = statementAmount(aud[1]!);
          else closing = statementAmount(aud[1]!);
          balanceSection = null;
          continue;
        }
      }
      if (/Merchant Currency\s+Multi-Currency/i.test(raw)) {
        amountAt = raw.indexOf("Merchant Currency");
        balanceSection = null;
        continue;
      }
      if (/Transaction Description\s+Merchant Name\s*\/\s*Address/i.test(raw)) {
        merchantAt = raw.indexOf("Merchant Name");
        inTable = amountAt > merchantAt && merchantAt >= 0;
        continue;
      }
      if (/^Please check the entries|^Page \d+ of \d+/i.test(value)) {
        inTable = false;
        continue;
      }
      if (!inTable || /^Number\s+Amount\s+Amount$/i.test(value)) continue;
      const match = raw.match(posted);
      if (match) {
        finish();
        const original = money(raw.slice(amountAt));
        const merchant = raw.slice(merchantAt - 1, amountAt).trim();
        // Require the whole amount cell; a malformed value cannot donate a
        // numeric suffix that happens to look like valid money.
        entry = {
          dateText: match[1]!,
          type: raw.slice(match[0].length, merchantAt - 1).trim(),
          merchant: [
            ...prefix.map((part) => part.text),
            ...(merchant ? [merchant] : []),
          ],
          original,
          sources: [...prefix.map((part) => part.source), source],
          settlements: [],
        };
        prefix = [];
        continue;
      }
      if (/^Exchange rate\b/i.test(value)) {
        const amount = money(raw.slice(amountAt));
        if (entry && amount) entry.settlements.push({ value: amount, source });
        else orphan(source);
        continue;
      }
      const merchantOnly =
        raw.slice(0, merchantAt - 1).trim() === "" &&
        raw.slice(amountAt).trim() === "";
      if (merchantOnly) {
        const next = rawLines
          .slice(lineIndex + 1)
          .find(
            (line) =>
              line.trim() &&
              (line.slice(0, merchantAt - 1).trim() ||
                line.slice(amountAt).trim()),
          );
        if (next && posted.test(next)) prefix.push({ text: value, source });
        else if (entry && !entry.settlements.length) {
          entry.merchant.push(value);
          entry.sources.push(source);
        } else source.status = "review";
      } else source.status = "review";
    }
  }
  finish();
  prefix.forEach(({ source }) => {
    source.status = "review";
  });
  const dates = rows
    .map((row) => row.date)
    .filter(Boolean)
    .sort();
  if (opening !== null && (start || dates[0]))
    details.opening = { date: start || dates[0]!, amountCents: opening };
  if (closing !== null && (end || dates.at(-1)))
    details.closing = { date: end || dates.at(-1)!, amountCents: closing };
  if (!details.opening || !details.closing)
    warn(
      "An AUD opening or closing balance was not identified. Check the PDF and read again with a complete statement; other currency balances are not used.",
    );
  if (
    opening !== null &&
    closing !== null &&
    opening + rows.reduce((sum, row) => sum + row.amountCents, 0) !== closing
  )
    warn(
      "Opening balance plus extracted AUD transactions does not match the closing balance. Check the highlighted source lines and use a corrected statement or CSV for missing entries before importing.",
    );
  if (details.lines.some((source) => source.status === "review"))
    warn(
      "Some source lines need review. Open Source & reading notes and compare the PDF; read again with a corrected statement or use a CSV export for incomplete entries.",
    );
  if (rows.some((row) => row.kind === "transfer"))
    warn(
      "Qantas Pay reloads are suggested as transfers. Choose the funding account in Review transactions, or change the type if the money was received from someone else.",
    );
  // Do not retry a recognised foreign-only/unreadable wallet through generic
  // OCR or AI parsing, where its currency columns could be lost.
  if (!rows.length)
    throw new HttpError(
      422,
      "No complete AUD transactions were found in this Qantas Pay statement. Export the AUD wallet as a clearer PDF or CSV, then try again.",
    );
  if (rows.length > 10000)
    throw new HttpError(
      400,
      "Upload up to 10,000 statement transactions at a time.",
    );
  return { rows, details };
}
