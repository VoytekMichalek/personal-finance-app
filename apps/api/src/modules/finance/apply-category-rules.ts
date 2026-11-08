import {
  applyCategoryRulesSchema,
  savedCategoryRuleChanges,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";

export async function applyCategoryRules(body: unknown) {
  const { records } = applyCategoryRulesSchema.parse(body);
  return prisma.$transaction(
    async (tx) => {
      const [transactions, accounts, categories, rules] = await Promise.all([
        tx.transaction.findMany({
          where: { id: { in: records.map((r) => r.id) } },
        }),
        tx.account.findMany(),
        tx.category.findMany(),
        tx.rule.findMany(),
      ]);
      const current = new Map(
        savedCategoryRuleChanges(
          json({ transactions, accounts, categories, rules }),
        ).map((row) => [row.id, row]),
      );
      if (
        records.some((row) => {
          const match = current.get(row.id);
          return (
            !match ||
            match.version !== row.version ||
            match.categoryId !== row.categoryId
          );
        })
      )
        throw new HttpError(
          409,
          "Transactions or saved rules changed. Refresh data and review the matches before applying again.",
        );
      // Apply only the reviewed IDs. New matches must wait for another review.
      for (const categoryId of new Set(records.map((r) => r.categoryId))) {
        const group = records.filter((r) => r.categoryId === categoryId);
        for (let offset = 0; offset < group.length; offset += 500) {
          const chunk = group.slice(offset, offset + 500);
          const changed = await tx.transaction.updateMany({
            where: {
              categoryId: null,
              OR: chunk.map(({ id, version }) => ({ id, version })),
            },
            data: { categoryId, version: { increment: 1 } },
          });
          if (changed.count !== chunk.length)
            throw new HttpError(
              409,
              "A transaction changed. Refresh data and review the matches before applying again.",
            );
        }
      }
      return { updated: records.length };
    },
    { timeout: 15000 },
  );
}
