import type { Account, Category, ImportRow, Rule } from "./types.js";

export const normaliseDescription = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
export const matchesRule = (
  description: string,
  rule: Pick<Rule, "pattern" | "matchMode">,
) =>
  rule.matchMode === "exact"
    ? normaliseDescription(description) === normaliseDescription(rule.pattern)
    : normaliseDescription(description).includes(
        normaliseDescription(rule.pattern),
      );
export const compareRules = (
  a: Pick<Rule, "matchMode" | "priority" | "id">,
  b: Pick<Rule, "matchMode" | "priority" | "id">,
) =>
  Number(b.matchMode === "exact") - Number(a.matchMode === "exact") ||
  a.priority - b.priority ||
  a.id.localeCompare(b.id);

export function applyTransferRules(
  rows: ImportRow[],
  rules: Rule[],
  accountId: string,
  accounts: Pick<Account, "id" | "archived" | "openingDate">[],
) {
  const eligible = rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.kind === "transfer" &&
        rule.accountId === accountId,
    )
    .sort(compareRules);
  for (const row of rows) {
    if (row.error) continue;
    const rule = eligible.find(
      (item) =>
        matchesRule(row.description, item) &&
        item.direction === (row.amountCents < 0 ? "out" : "in") &&
        accounts.some(
          (account) =>
            account.id === item.counterAccountId &&
            account.id !== accountId &&
            !account.archived &&
            row.date >= account.openingDate,
        ),
    );
    if (!rule) continue;
    row.kind = "transfer";
    row.categoryId = null;
    row.counterAccountId = rule.counterAccountId!;
    row.categorySource = "rule";
  }
}

const merchants: [RegExp, string][] = [
  [/woolworths|coles|aldi|iga\b/i, "Groceries"],
  [/netflix|spotify|disney|prime video|apple.com\/bill/i, "Subscriptions"],
  [/salary|payroll|wages/i, "Salary"],
  [/energ|electric|water|telstra|optus|internet/i, "Utilities"],
  [/uber|translink|petrol|caltex|ampol|bp\b/i, "Transport"],
  [/cafe|restaurant|mcdonald|coffee/i, "Dining"],
  [/pharmacy|chemist|medical|dental/i, "Health"],
  [/rent|mortgage/i, "Home"],
  [/insurance|allianz|suncorp|bupa|medibank|nib\b|aami|nrma/i, "Insurance"],
];
export function categorise(
  rows: ImportRow[],
  categories: Category[],
  rules: Rule[],
  history: Pick<ImportRow, "description" | "categoryId">[] = [],
) {
  for (const row of rows) {
    if (row.error || row.kind === "transfer") continue;
    const eligible = categories.filter(
      (c) =>
        !c.archived &&
        c.kind === (row.kind === "income" ? "income" : "expense"),
    );
    const rule = [...rules]
      .sort(compareRules)
      .find(
        (r) =>
          r.enabled &&
          matchesRule(row.description, r) &&
          eligible.some((c) => c.id === r.categoryId),
      );
    const previous = history.find(
      (r) =>
        r.description.toLowerCase() === row.description.toLowerCase() &&
        eligible.some((c) => c.id === r.categoryId),
    );
    const hint = merchants.find(([pattern]) => pattern.test(row.description));
    row.categoryId =
      rule?.categoryId ??
      previous?.categoryId ??
      eligible.find((c) => c.name.toLowerCase() === hint?.[1].toLowerCase())
        ?.id ??
      (eligible.some((c) => c.id === row.categoryId) ? row.categoryId : null);
    row.categorySource = rule ? "rule" : undefined;
  }
}
