// Synthetic statement with separate posting/processed dates and wrapped details.
export const bankTableHeading =
  "Date".padEnd(10) +
  "Processed".padEnd(10) +
  "Description".padEnd(22) +
  "Debits ($)".padEnd(14) +
  "Credits ($)".padEnd(14) +
  "Balance ($)";
export function bankTableRow(
  date: string,
  processed: string,
  description: string,
  debit: string,
  credit: string,
  balance: string,
) {
  return (
    date.padEnd(10) +
    processed.padEnd(10) +
    description.padEnd(22) +
    debit.padStart(12).padEnd(14) +
    credit.padStart(12).padEnd(14) +
    balance.padStart(11)
  );
}
export function bankLayoutStatement() {
  return [
    [
      "Everyday account statement",
      "Statement period",
      "30 Dec 2025 - 03 Jan 2026",
      "Opening balance 500.00",
      "Total credits 282.50",
      "Total debits 212.50",
      "Closing balance 570.00",
      bankTableHeading,
      "2025",
      bankTableRow("30-Dec", "30-Dec", "From: Savings", "", "250.00", "750.00"),
      "                    Rent",
      bankTableRow("31-Dec", "31-Dec", "To: Property", "-200.00", "", "550.00"),
      "                    Team",
      "                    3/14 Example - rent",
      "Page 1 of 3 | Statement continues",
    ],
    [
      "Everyday account statement",
      bankTableHeading,
      "2026",
      bankTableRow(
        "01-Jan",
        "02-Jan",
        "Cafe Plan 9.99",
        "-12.50",
        "",
        "537.50",
      ),
      "                    Card purchase",
      bankTableRow("02-Jan", "03-Jan", "From: Friend", "", "30.00", "567.50"),
      "Page 2 of 3 | Statement continues",
    ],
    [
      "Everyday account statement",
      bankTableHeading,
      bankTableRow("03-Jan", "04-Jan", "Interest", "", "2.50", "570.00"),
      "Page 3 of 3",
    ],
  ];
}
