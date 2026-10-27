import type { Category, ImportRow, Rule } from "./types.js";

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
      .sort((a, b) => a.priority - b.priority)
      .find(
        (r) =>
          r.enabled &&
          row.description.toLowerCase().includes(r.pattern.toLowerCase()) &&
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
  }
}
