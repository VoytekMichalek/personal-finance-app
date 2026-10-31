import { matchesRule } from "./categorisation.js";
import { rememberedRule, suggestRememberedRule } from "./remembered-rule.js";
import type { ImportRow } from "./types.js";

const categoryKind = (row: ImportRow) =>
  row.kind === "income" ? "income" : "expense";

// Both upload reviews use the same propagation and undo rules across all pages.
export function updateImportRows(
  rows: ImportRow[],
  rowNumber: number,
  patch: Partial<ImportRow>,
): ImportRow[] {
  const source = rows.find((row) => row.rowNumber === rowNumber);
  if (!source) return rows;
  const categoryEdit = ["categoryId", "description", "kind"].some((key) =>
    Object.hasOwn(patch, key),
  );
  const changesRule =
    categoryEdit ||
    Object.hasOwn(patch, "rememberCategory") ||
    Object.hasOwn(patch, "rememberPattern") ||
    Object.hasOwn(patch, "rememberMatchMode") ||
    patch.include === false;
  let updated = rows.map((row) => {
    if (changesRule && row.rememberedFrom === rowNumber) {
      return {
        ...row,
        ...row.previousCategory,
        rememberedFrom: undefined,
        previousCategory: undefined,
      };
    }
    return row;
  });
  updated = updated.map((row) =>
    row.rowNumber !== rowNumber
      ? row
      : {
          ...row,
          ...patch,
          ...(patch.rememberCategory === true
            ? {
                rememberPattern:
                  row.rememberPattern ??
                  suggestRememberedRule(row.description).pattern,
                rememberMatchMode:
                  row.rememberMatchMode ??
                  suggestRememberedRule(row.description).matchMode,
              }
            : {}),
          ...(categoryEdit || patch.rememberCategory === true
            ? {
                ...(Object.hasOwn(patch, "categoryId") ||
                patch.rememberCategory === true
                  ? { categoryChosen: true }
                  : {}),
                categorySource: undefined,
                rememberedFrom: undefined,
                previousCategory: undefined,
              }
            : {}),
          ...(patch.include === false ||
          Object.hasOwn(patch, "kind") ||
          Object.hasOwn(patch, "description") ||
          patch.categoryId === null
            ? {
                rememberCategory: false,
                rememberPattern: undefined,
                rememberMatchMode: undefined,
              }
            : {}),
        },
  );
  const chosen = updated.find((row) => row.rowNumber === rowNumber)!;
  if (
    !changesRule ||
    !chosen.rememberCategory ||
    !chosen.categoryId ||
    !chosen.include ||
    chosen.error ||
    chosen.kind === "transfer"
  )
    return updated;
  const rule = rememberedRule(chosen);
  if (!rule.pattern || !matchesRule(chosen.description, rule)) return updated;
  return updated.map((row) => {
    if (
      row.rowNumber === rowNumber ||
      row.error ||
      row.kind === "transfer" ||
      categoryKind(row) !== categoryKind(chosen) ||
      !matchesRule(row.description, rule)
    )
      return row;
    return {
      ...row,
      categoryId: chosen.categoryId,
      categoryChosen: true,
      categorySource: "remembered",
      rememberCategory: false,
      rememberedFrom: rowNumber,
      previousCategory: row.previousCategory ?? {
        categoryId: row.categoryId,
        categoryChosen: row.categoryChosen,
        categorySource: row.categorySource,
      },
    };
  });
}
