import {
  matchingCategoryTransactions,
  matchesRule,
  rememberTransactionCategorySchema,
} from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateCategory } from "./service.js";
import { saveRememberedRule } from "./category-rules.js";

const conflict = () =>
  new HttpError(
    409,
    "Matching transactions changed. Review the refreshed matches and try again.",
  );
export async function rememberTransactionCategory(body: unknown) {
  const input = rememberTransactionCategorySchema.parse(body);
  return prisma.$transaction(
    async (tx) => {
      const source = await tx.transaction.findUnique({
        where: { id: input.source.id },
      });
      if (!source || source.version !== input.source.version) throw conflict();
      if (source.kind === "transfer" || !matchesRule(source.description, input))
        throw new HttpError(400, "Choose text matching a regular transaction.");
      await validateCategory(tx, input.categoryId, source.kind);
      const rows = await tx.transaction.findMany({
        select: {
          id: true,
          version: true,
          kind: true,
          description: true,
          categoryId: true,
        },
      });
      const matches = matchingCategoryTransactions(rows, source.kind, input);
      const confirmed = new Map(
        input.records.map((row) => [row.id, row.version]),
      );
      // Apply exactly the reviewed full-ledger set; new or changed matches require another review.
      if (
        matches.length !== confirmed.size ||
        matches.some((row) => confirmed.get(row.id) !== row.version)
      )
        throw conflict();
      for (let offset = 0; offset < input.records.length; offset += 500) {
        const updated = await tx.transaction.updateMany({
          where: { OR: input.records.slice(offset, offset + 500) },
          data: { categoryId: input.categoryId, version: { increment: 1 } },
        });
        if (updated.count !== Math.min(500, input.records.length - offset))
          throw conflict();
      }
      const rule = await saveRememberedRule(
        tx,
        input,
        input.categoryId,
        source.kind === "income" ? "income" : "expense",
      );
      return {
        matched: matches.length,
        changed: matches.filter((row) => row.categoryId !== input.categoryId)
          .length,
        rule,
      };
    },
    { timeout: 15000 },
  );
}
