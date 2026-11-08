import { statementPdf } from "./statement-fixture.js";

// Fictional names, references and amounts. Retain only the printed layout.
export const qantasHeading = [
  "Card".padEnd(69) + "Merchant Currency".padEnd(18) + "Multi-Currency",
  "     Date".padEnd(18) +
    "Transaction Description".padEnd(25) +
    "Merchant Name/ Address",
  "Number".padEnd(69) + "Amount".padEnd(18) + "Amount",
];
export const qantasRow = (
  date: string,
  type: string,
  merchant: string,
  amount: string,
) =>
  ("1234 " + date).padEnd(18) +
  type.padEnd(25) +
  merchant.padEnd(26) +
  amount.padStart(16);
export const qantasMerchant = (text: string) => " ".repeat(43) + text;
export const qantasExchange = (amount: string) =>
  " ".repeat(18) + "Exchange rate 1.000000".padEnd(69) + amount.padStart(16);
const footer = [
  "Please check the entries on your statement",
  "Qantas Pay - synthetic fixture",
];
export function qantasStatement(incomplete = false) {
  return [
    [
      "Statement for Period   21 Dec 2025 to 20 Jan 2026",
      "Opening Balance for Period",
      "500.00 AUD   12.00 USD   99.00 GBP   0 JPY",
      "Closing Balance for Period",
      `${incomplete ? "553.42" : "563.41"} AUD   12.00 USD   99.00 GBP   0 JPY`,
      ...qantasHeading,
      qantasMerchant("EXAMPLE GROCER"),
      qantasRow("18-01-2026", "PURCHASE", "", "-12.34 AUD"),
      qantasMerchant("BRISBANE QLD"),
      ...footer,
    ],
    [
      ...qantasHeading,
      qantasExchange("-12.34 AUD"),
      qantasRow("13-01-2026", "CREDIT VOUCHER", "EXAMPLE REFUND", "3.25 AUD"),
      qantasExchange("3.25 AUD"),
      qantasRow("06-01-2026", "PURCHASE", "EXAMPLE OVERSEAS", "-5.00 USD"),
      qantasExchange("-7.50 AUD"),
      qantasRow(
        "05-01-2026",
        "PREPAID RELOAD",
        "RELOAD-123456789",
        "100.00 AUD",
      ),
      ...(incomplete ? [qantasExchange("-9.99 AUD")] : []),
      qantasExchange("100.00 AUD"),
      qantasRow("29-12-2025", "PURCHASE", "EXAMPLE CAFE", "-20.00 AUD"),
      ...footer,
    ],
    [...qantasHeading, qantasExchange("-20.00 AUD"), ...footer],
  ];
}
export const qantasPdf = (incomplete = false) =>
  statementPdf(qantasStatement(incomplete), 8);
