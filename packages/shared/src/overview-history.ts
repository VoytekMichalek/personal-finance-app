import { accountBalance, forecast } from "./finance.js";
import { isCashAccount } from "./accounts.js";
import { addDays, monthEnd } from "./money.js";
import type { Snapshot } from "./types.js";

function shiftMonth(date: string, offset: number) {
  const month = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1 + offset,
      1,
    ),
  )
    .toISOString()
    .slice(0, 7);
  return `${month}-${String(Math.min(Number(date.slice(8)), Number(monthEnd(month).slice(8)))).padStart(2, "0")}`;
}

/** Recorded daily cash balances, joined to the existing forecast at today's closing balance. */
export function balanceOutlook(snapshot: Snapshot) {
  const from = shiftMonth(snapshot.today, -6),
    to = shiftMonth(snapshot.today, 3);
  const accounts = snapshot.accounts.filter(isCashAccount);
  const firstRecorded = accounts
    .map((a) => a.openingDate)
    .filter((date) => date <= snapshot.today)
    .sort()[0];
  const days = Math.round(
    (Date.parse(to) - Date.parse(snapshot.today)) / 86400000,
  );
  const projected = forecast(snapshot, days);
  const points: {
    date: string;
    actualCents: number | null;
    projectedCents: number | null;
  }[] = [];
  for (let date = from; date < snapshot.today; date = addDays(date, 1)) {
    points.push({
      date,
      actualCents:
        firstRecorded && date >= firstRecorded
          ? accounts.reduce(
              (sum, a) => sum + accountBalance(a, snapshot.transactions, date),
              0,
            )
          : null,
      projectedCents: null,
    });
  }
  for (const point of projected)
    points.push({
      date: point.date,
      actualCents:
        point.date === snapshot.today && firstRecorded
          ? point.balanceCents
          : null,
      projectedCents: point.balanceCents,
    });
  return { from, to, firstRecorded, points };
}

/** Six complete calendar months; transfers/income never count as spending, refunds reduce it. */
export function spendingHistory(snapshot: Snapshot, owner = "all") {
  return Array.from({ length: 6 }, (_, i) => {
    const from = shiftMonth(snapshot.today.slice(0, 7) + "-01", i - 6),
      to = monthEnd(from.slice(0, 7));
    const rows = snapshot.transactions.filter(
      (t) =>
        (owner === "all" || t.owner === owner) &&
        t.date >= from &&
        t.date <= to &&
        (t.kind === "expense" || t.kind === "refund"),
    );
    return {
      from,
      to,
      spentCents: -rows.reduce((sum, t) => sum + t.amountCents, 0),
      count: rows.length,
    };
  });
}
