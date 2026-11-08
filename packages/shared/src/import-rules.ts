import { applyTransferRules, categoryRuleMatcher } from "./categorisation.js";
import type { ImportRow, Snapshot } from "./types.js";

/** Refresh suggestions throughout a review without replacing explicit choices. */
export function refreshImportRules(
  rows: ImportRow[],
  data: Pick<Snapshot, "accounts" | "categories" | "rules">,
  accountId: string,
): ImportRow[] {
  const match = categoryRuleMatcher(data.categories, data.rules);
  return rows.map((row) => {
    if (
      row.error ||
      row.categoryChosen ||
      row.rememberCategory ||
      row.rememberedFrom !== undefined ||
      row.linkExisting ||
      row.reconcileExisting ||
      (row.kind === "transfer" && row.categorySource !== "rule")
    )
      return row;
    const updated = { ...row };
    if (!row.kindChosen)
      applyTransferRules([updated], data.rules, accountId, data.accounts);
    if (updated.kind === "transfer") return updated;
    const rule = match(updated);
    if (rule) {
      updated.categoryId = rule.categoryId;
      updated.categorySource = "rule";
    } else if (updated.categorySource === "rule") {
      updated.categorySource = undefined;
    }
    return updated;
  });
}
