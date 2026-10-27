import type { ImportRow } from "@finance/shared";
import { send } from "../lib/api";
export type CategorySuggestion = {
  rowNumber: number;
  categoryId: string | null;
};
export async function suggestCsvBatch(
  csv: string,
  hasHeaders: boolean,
  rows: ImportRow[],
) {
  // One bounded retry handles a transient provider failure without losing earlier batches.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await send<{ categories: CategorySuggestion[] }>(
        "/imports/suggest",
        {
          csv,
          hasHeaders,
          rows: rows.map(({ rowNumber, description, amountCents, kind }) => ({
            rowNumber,
            description,
            amountCents,
            kind,
          })),
        },
      );
      return result.categories;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  return [];
}
