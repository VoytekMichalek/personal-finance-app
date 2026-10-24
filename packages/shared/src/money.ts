export function parseMoney(text: string): number {
  const cleaned = text.trim().replace(/[$,\s]/g, "");
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const value = negative ? cleaned.slice(1, -1) : cleaned;
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with up to two decimal places");
  const [whole, fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const sign = negative || value.startsWith("-") ? -1 : 1;
  const result = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(result)) throw new Error("Amount is too large");
  return result;
}
export const money = (cents: number, compact = false) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: compact ? 0 : 2,
  }).format((cents || 0) / 100);
export const moneyInput = (cents: number) => (cents / 100).toFixed(2);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const monthEnd = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
