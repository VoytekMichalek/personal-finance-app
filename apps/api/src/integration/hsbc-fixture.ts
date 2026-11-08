// Fictional amounts, references and names; only HSBC's column layout is retained.
export const hsbcHeading =
  "Date".padEnd(10) +
  "Transaction Details".padEnd(34) +
  "Debits/Withdrawals".padEnd(20) +
  "Credits/Deposits".padEnd(18) +
  "Balance";
export function hsbcRow(
  date: string,
  description: string,
  debit = "",
  credit = "",
  balance = "",
) {
  return (
    date.padEnd(10) +
    description.padEnd(34) +
    debit.padStart(18).padEnd(20) +
    credit.padStart(16).padEnd(18) +
    balance.padStart(10)
  );
}
export function hsbcStatement() {
  return [
    [
      "HSBC Bank Australia Limited",
      "Statement period to 2 Jan 2026",
      "Portfolio summary 601.10",
    ],
    [
      "HSBC Bank Australia Limited",
      "Statement period to 2 Jan 2026",
      "EVERYDAY GLOBAL A/C BSB No. 123456 Account 123456789 Currency AUD",
      hsbcHeading,
      hsbcRow("30 Dec", "BALANCE BROUGHT FORWARD", "", "", "500.00"),
      hsbcRow("30 Dec", "EFTPOS VISA AUD Grocery", "10.00"),
      hsbcRow("", "Example Town AU").trimEnd(),
      hsbcRow("", "29DEC25 111111 Grocery Cashback", "", "0.20", "490.20"),
      hsbcRow("31 Dec", "Transit", "2.00"),
      hsbcRow("", "Cafe", "20.00"),
      "Important Information - call 1300 000 000",
      "31 Dec Not a transaction 999.00",
    ],
    [
      "HSBC Bank Australia Limited",
      "Statement period to 2 Jan 2026",
      "EVERYDAY GLOBAL A/C continued",
      hsbcHeading,
      hsbcRow("", "Central AU").trimEnd(),
      hsbcRow("", "30DEC25 222222 Cafe Cashback", "", "0.40"),
      hsbcRow("", "Transfer from savings", "", "100.00", "568.60"),
      hsbcRow("01 Jan", "Monthly fee", "5.00", "", "563.60"),
      hsbcRow("", "Gift", "", "50.00", "613.60"),
      hsbcRow("02 Jan", "Plan 12.50 reference", "12.50", "", "601.10"),
      hsbcRow("02 Jan", "CLOSING BALANCE", "", "", "601.10"),
      hsbcRow("", "Transaction Total", "49.50", "150.60"),
      hsbcRow("", "Transaction Number", "5", "4"),
      "END OF STATEMENT",
    ],
    [
      "HSBC Bank Australia Limited",
      "Important Information",
      "02 Jan Disclosure example 25.00",
    ],
  ];
}
