import { z } from "zod";
import { categoryRuleMatcher } from "./categorisation.js";
import type { Snapshot } from "./types.js";

export const applyCategoryRulesSchema = z.object({
  records: z
    .array(
      z.object({
        id: z.uuid(),
        version: z.number().int().positive(),
        categoryId: z.uuid(),
      }),
    )
    .min(1)
    .max(10000)
    .refine(
      (records) =>
        new Set(records.map((row) => row.id)).size === records.length,
      "Select each transaction only once.",
    ),
});

export function savedCategoryRuleChanges(
  data: Pick<Snapshot, "transactions" | "accounts" | "categories" | "rules">,
) {
  const match = categoryRuleMatcher(data.categories, data.rules);
  const accounts = new Set(
    data.accounts.filter((a) => !a.archived).map((a) => a.id),
  );
  return data.transactions.flatMap((row) => {
    if (row.categoryId || !accounts.has(row.accountId)) return [];
    const rule = match(row);
    return rule?.categoryId
      ? [{ id: row.id, version: row.version, categoryId: rule.categoryId }]
      : [];
  });
}
