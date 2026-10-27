import type { Transaction } from "./types.js";

export type ImportConflictMatch = Pick<
  Transaction,
  | "id"
  | "version"
  | "accountId"
  | "date"
  | "amountCents"
  | "description"
  | "transferGroupId"
  | "kind"
> & { scheduleId?: string | null; occurrenceDate?: string | null };

export type ImportConflict = {
  rowNumber: number;
  reason: "duplicate" | "counterpart" | "stale-link";
  matches: ImportConflictMatch[];
};

export type ImportConflictDetails = {
  type: "import-conflicts";
  conflicts: ImportConflict[];
};
