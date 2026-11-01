import {
  compareRules,
  matchesRule,
  transferCounterpart,
  type Snapshot,
  type Transaction,
} from "@finance/shared";

// A match describes the current saved result, not how the transaction was created.
export function matchingSavedRules(
  data: Snapshot,
  rows: Transaction[],
): Set<string> {
  const rules = data.rules
    .filter(
      (rule) =>
        rule.enabled &&
        (rule.kind === "transfer" ||
          data.categories.some(
            (category) => category.id === rule.categoryId && !category.archived,
          )),
    )
    .sort(compareRules);
  return new Set(
    rows
      .filter((row) =>
        row.kind === "transfer"
          ? rules.find(
              (rule) =>
                rule.kind === "transfer" &&
                rule.accountId === row.accountId &&
                rule.direction === (row.amountCents < 0 ? "out" : "in") &&
                matchesRule(row.description, rule),
            )?.counterAccountId ===
              transferCounterpart(row, data.transactions)?.accountId &&
            !!transferCounterpart(row, data.transactions)
          : row.categoryId &&
            rules.find(
              (rule) =>
                data.categories.some(
                  (category) =>
                    category.id === rule.categoryId &&
                    category.kind ===
                      (row.kind === "income" ? "income" : "expense"),
                ) && matchesRule(row.description, rule),
            )?.categoryId === row.categoryId,
      )
      .map((row) => row.id),
  );
}
