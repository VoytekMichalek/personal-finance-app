import type { Schedule, Transaction } from "./types.js";
import { transferCounterpart } from "./transaction-rules.js";

export function scheduleImpact(schedule: Schedule, accountId: string): number {
  if (schedule.kind === "transfer")
    return (
      schedule.amountCents *
      (accountId === schedule.accountId
        ? -1
        : accountId === schedule.counterAccountId
          ? 1
          : 0)
    );
  if (schedule.accountId !== accountId) return 0;
  return schedule.amountCents * (schedule.kind === "income" ? 1 : -1);
}

export function canMatchSchedule(
  row: Transaction,
  schedule: Schedule,
  rows: Transaction[],
): boolean {
  if (
    row.scheduleId ||
    row.occurrenceDate ||
    row.accountId !== schedule.accountId ||
    row.kind !== schedule.kind ||
    Math.abs(row.amountCents) !== schedule.amountCents
  )
    return false;
  if (schedule.kind !== "transfer") return true;
  const other = transferCounterpart(row, rows);
  return (
    row.amountCents < 0 &&
    !!other &&
    other.accountId === schedule.counterAccountId &&
    !other.scheduleId &&
    !other.occurrenceDate
  );
}
