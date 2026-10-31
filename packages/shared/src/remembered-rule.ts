import { matchesRule, normaliseDescription } from "./categorisation.js";

export type RememberedRule = {
  pattern: string;
  matchMode: "exact" | "contains";
};
// Only strip a recognizable trailing bank period/reference, retaining merchant and issuer IDs.
// Other descriptions stay exact until the reviewer explicitly chooses contains matching.
export function suggestRememberedRule(description: string): RememberedRule {
  const original = normaliseDescription(description);
  const pattern = original.replace(
    /\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\d{4}|\d{2})\/\d{4,}$/,
    "",
  );
  return pattern !== original && /[a-z]{3}/.test(pattern)
    ? { pattern, matchMode: "contains" }
    : { pattern: original, matchMode: "exact" };
}
export function rememberedRule(row: {
  description: string;
  rememberPattern?: string;
  rememberMatchMode?: "exact" | "contains";
}): RememberedRule {
  const suggested = suggestRememberedRule(row.description);
  return {
    pattern: normaliseDescription(row.rememberPattern ?? suggested.pattern),
    matchMode: row.rememberMatchMode ?? suggested.matchMode,
  };
}

export function matchingCategoryTransactions<
  T extends { kind: string; description: string },
>(rows: T[], sourceKind: string, rule: RememberedRule): T[] {
  return rows.filter(
    (row) =>
      row.kind !== "transfer" &&
      (row.kind === "income") === (sourceKind === "income") &&
      matchesRule(row.description, rule),
  );
}
