import { useMemo } from "react";
import type { ImportConflict, ImportRow, Snapshot } from "@finance/shared";
import { ApiError } from "../lib/api";

export function useImportConflicts(
  data: Snapshot,
  accountId: string,
  rows: ImportRow[],
  error?: Error | null,
) {
  return useMemo(() => {
    const conflicts: ImportConflict[] = [];
    const bySignature = new Map<string, Snapshot["transactions"]>();
    const chosen = new Map<string, number>();
    for (const item of data.transactions) {
      const key = `${item.accountId}|${item.date}|${item.amountCents}`;
      const matches = bySignature.get(key) ?? [];
      matches.push(item);
      bySignature.set(key, matches);
    }
    for (const row of rows) {
      if (row.include && !row.error && row.linkExisting)
        chosen.set(
          row.linkExisting.id,
          (chosen.get(row.linkExisting.id) ?? 0) + 1,
        );
    }
    for (const row of rows) {
      if (!row.include || row.error) continue;
      const matches =
        bySignature.get(`${accountId}|${row.date}|${row.amountCents}`) ?? [];
      if (matches.length && !row.allowDuplicate)
        conflicts.push({
          rowNumber: row.rowNumber,
          reason: "duplicate",
          matches,
        });
      if (row.kind !== "transfer" || !row.counterAccountId) continue;
      const counterparts =
        bySignature.get(
          `${row.counterAccountId}|${row.date}|${-row.amountCents}`,
        ) ?? [];
      if (row.linkExisting) {
        const match = counterparts.find(
          (item) => item.id === row.linkExisting?.id,
        );
        if (
          (chosen.get(row.linkExisting.id) ?? 0) > 1 ||
          !match ||
          match.version !== row.linkExisting.version ||
          match.transferGroupId ||
          match.scheduleId ||
          match.occurrenceDate ||
          match.kind === "transfer"
        )
          conflicts.push({
            rowNumber: row.rowNumber,
            reason: "stale-link",
            matches: counterparts,
          });
      } else if (counterparts.length && !row.allowDuplicate)
        conflicts.push({
          rowNumber: row.rowNumber,
          reason: "counterpart",
          matches: counterparts,
        });
    }
    // Server results catch payments added or changed since this snapshot loaded.
    if (
      error instanceof ApiError &&
      error.details?.type === "import-conflicts"
    ) {
      for (const conflict of error.details.conflicts) {
        if (
          !conflicts.some(
            (item) =>
              item.rowNumber === conflict.rowNumber &&
              item.reason === conflict.reason,
          )
        )
          conflicts.push(conflict);
      }
    }
    return conflicts;
  }, [data.transactions, accountId, rows, error]);
}
