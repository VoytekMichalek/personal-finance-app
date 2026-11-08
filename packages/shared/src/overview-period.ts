import { monthEnd } from "./money.js";
export function overviewPeriod(
  today: string,
  month = today.slice(0, 7),
  period: "month" | "year" = "month",
) {
  const currentMonth = today.slice(0, 7);
  const selected =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= currentMonth
      ? month
      : currentMonth;
  const from =
    period === "year" ? today.slice(0, 4) + "-01-01" : selected + "-01";
  const to =
    period === "year" || selected === currentMonth ? today : monthEnd(selected);
  return { from, to, month: period === "year" ? currentMonth : selected };
}
