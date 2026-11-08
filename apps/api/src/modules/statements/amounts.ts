import { parseMoney } from "@finance/shared";
export const statementMoneyPattern =
  /(?:[-+]?\$?\(?\d[\d,]*\.\d{2}\)?(?:\s?(?:CR|DR))?)/gi;
export const openingLabel =
  /opening balance|previous (?:statement )?balance|last statement balance|balance (?:brought forward|b\/f|(?:at|from) (?:the )?(?:last|previous) statement)|beginning balance/i;
export const closingLabel =
  /closing balance|new balance|balance carried forward|balance c\/f|ending balance/i;
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
