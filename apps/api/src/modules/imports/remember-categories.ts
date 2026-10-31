import { saveRememberedRule } from "../finance/category-rules.js";
import {
  matchesRule,
  rememberedRule,
  type commitImportSchema,
} from "@finance/shared";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { HttpError } from "../../lib/errors.js";
import { validateCategory } from "../finance/service.js";

export async function rememberCategories(
  tx: Prisma.TransactionClient,
  rows: z.infer<typeof commitImportSchema>["rows"],
) {
  const remembered = rows.filter((row) => row.include && row.rememberCategory);
  if (!remembered.length) return;
  const seen = new Map<string, string>();
  for (const row of remembered) {
    const kind = row.kind ?? (row.amountCents < 0 ? "expense" : "income");
    const { pattern, matchMode } = rememberedRule(row);
    if (!pattern || !row.categoryId || kind === "transfer")
      throw new HttpError(
        400,
        "Choose a category for each remembered transaction.",
      );
    if (!matchesRule(row.description, { pattern, matchMode }))
      throw new HttpError(
        400,
        "The remembered text must match its transaction description.",
      );
    await validateCategory(tx, row.categoryId, kind);
    const categoryKind = kind === "income" ? "income" : "expense";
    const key = categoryKind + ":" + matchMode + ":" + pattern;
    if (seen.has(key) && seen.get(key) !== row.categoryId)
      throw new HttpError(
        400,
        "Choose one remembered category for each matching description.",
      );
    if (seen.has(key)) continue;
    seen.set(key, row.categoryId);
    await saveRememberedRule(
      tx,
      { pattern, matchMode },
      row.categoryId,
      categoryKind,
    );
  }
}
