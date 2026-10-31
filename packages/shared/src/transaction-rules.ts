import { z } from "zod";
import { bulkDeleteSchema, date } from "./schemas.js";
import { matchesRule } from "./categorisation.js";
import type { RememberedRule } from "./remembered-rule.js";
import type { Transaction } from "./types.js";

export const transactionFiltersSchema = z.object({
  search: z.string().max(250).default(""),
  accountId: z.uuid().nullable().default(null),
  owner: z.string().max(100).default("all"),
  categoryId: z
    .union([z.uuid(), z.literal("none")])
    .nullable()
    .default(null),
  kind: z
    .enum(["income", "expense", "refund", "transfer"])
    .nullable()
    .default(null),
  from: date.nullable().default(null),
  to: date.nullable().default(null),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export function filterTransactions<
  T extends Pick<
    Transaction,
    "accountId" | "owner" | "categoryId" | "kind" | "date" | "description"
  >,
>(rows: T[], filters: TransactionFilters): T[] {
  return rows.filter(
    (row) =>
      (!filters.search ||
        row.description.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.accountId || row.accountId === filters.accountId) &&
      (filters.owner === "all" || row.owner === filters.owner) &&
      (!filters.categoryId ||
        (filters.categoryId === "none"
          ? !row.categoryId
          : row.categoryId === filters.categoryId)) &&
      (!filters.kind ||
        (filters.kind === "expense"
          ? row.kind === "expense" || row.kind === "refund"
          : row.kind === filters.kind)) &&
      (!filters.from || row.date >= filters.from) &&
      (!filters.to || row.date <= filters.to),
  );
}
const versioned = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const rememberTransactionSchema = bulkDeleteSchema.extend({
  source: versioned,
  filters: transactionFiltersSchema,
  categoryId: z.uuid().nullable(),
  pattern: z.string().trim().min(1).max(250),
  matchMode: z.enum(["exact", "contains"]),
  transferChoices: z
    .array(
      z.object({
        id: z.uuid(),
        counterpart: versioned.optional(),
        createCounterpart: z.boolean().default(false),
      }),
    )
    .max(1000)
    .default([]),
});
export function transferCounterpart(
  row: Transaction,
  all: Transaction[],
): Transaction | undefined {
  if (row.kind !== "transfer" || !row.transferGroupId) return;
  const pair = all.filter(
    (item) => item.transferGroupId === row.transferGroupId,
  );
  const other = pair.find((item) => item.id !== row.id);
  return pair.length === 2 &&
    other?.kind === "transfer" &&
    other.accountId !== row.accountId &&
    other.date === row.date &&
    other.amountCents === -row.amountCents
    ? other
    : undefined;
}
export function matchingTransferTransactions(
  rows: Transaction[],
  source: Transaction,
  rule: RememberedRule,
) {
  return rows.filter(
    (row) =>
      row.accountId === source.accountId &&
      row.amountCents < 0 === source.amountCents < 0 &&
      matchesRule(row.description, rule),
  );
}
export function transferChoicesFor(
  row: Transaction,
  all: Transaction[],
  counterAccountId: string,
) {
  const counterpart = transferCounterpart(row, all);
  const issue =
    row.scheduleId || row.occurrenceDate
      ? "Linked to a scheduled payment. Review this row separately."
      : (row.kind === "transfer" || row.transferGroupId) &&
          (!counterpart ||
            counterpart.accountId !== counterAccountId ||
            counterpart.scheduleId ||
            counterpart.occurrenceDate)
        ? "This row has a different or incomplete transfer. Review it separately."
        : null;
  const candidates = all.filter(
    (item) =>
      item.accountId === counterAccountId &&
      item.kind !== "transfer" &&
      !item.transferGroupId &&
      !item.scheduleId &&
      !item.occurrenceDate &&
      item.date === row.date &&
      item.amountCents === -row.amountCents,
  );
  return { counterpart, candidates, issue };
}
