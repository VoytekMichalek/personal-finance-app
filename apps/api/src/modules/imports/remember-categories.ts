import { normaliseDescription, type commitImportSchema } from "@finance/shared";
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
  // Imports for different accounts may remember the same description concurrently.
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    "remembered-import-categories",
  );
  const seen = new Map<string, string>();
  for (const row of remembered) {
    const kind = row.kind ?? (row.amountCents < 0 ? "expense" : "income");
    const pattern = normaliseDescription(row.description);
    if (!pattern || !row.categoryId || kind === "transfer")
      throw new HttpError(
        400,
        "Choose a category for each remembered transaction.",
      );
    await validateCategory(tx, row.categoryId, kind);
    const categoryKind = kind === "income" ? "income" : "expense";
    const key = categoryKind + ":" + pattern;
    if (seen.has(key) && seen.get(key) !== row.categoryId)
      throw new HttpError(
        400,
        "Choose one remembered category for each matching description.",
      );
    if (seen.has(key)) continue;
    seen.set(key, row.categoryId);
    const existing = await tx.rule.findMany({
      where: { matchMode: "exact", category: { kind: categoryKind } },
    });
    const matches = existing.filter(
      (rule) => normaliseDescription(rule.pattern) === pattern,
    );
    const data = { categoryId: row.categoryId, enabled: true };
    if (matches.length) {
      await tx.rule.updateMany({
        where: { id: { in: matches.map((rule) => rule.id) } },
        data,
      });
    } else {
      await tx.rule.create({
        data: { ...data, pattern, matchMode: "exact", priority: 0 },
      });
    }
  }
}
