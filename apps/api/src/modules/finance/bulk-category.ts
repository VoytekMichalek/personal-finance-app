import { bulkCategorySchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateCategory } from "./service.js";

export async function bulkCategory(body: unknown) {
  const input = bulkCategorySchema.parse(body);
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.transaction.findMany({
        where: { id: { in: input.records.map((row) => row.id) } },
        select: { id: true, kind: true },
      });
      if (
        rows.length !== input.records.length ||
        rows.some((row) => row.kind === "transfer")
      )
        throw new HttpError(400, "Select income, expenses or refunds.");
      for (const kind of new Set(rows.map((row) => row.kind)))
        await validateCategory(tx, input.categoryId, kind);
      // Bounded parameter counts and atomic optimistic updates keep large selections fast.
      // Any stale record rolls back every chunk, including earlier successful updates.
      for (let offset = 0; offset < input.records.length; offset += 500) {
        const records = input.records.slice(offset, offset + 500);
        const changed = await tx.transaction.updateMany({
          where: { OR: records },
          data: { categoryId: input.categoryId, version: { increment: 1 } },
        });
        if (changed.count !== records.length)
          throw new HttpError(
            409,
            "A selected transaction changed. Refresh and try again.",
          );
      }
    },
    { timeout: 15000 },
  );
}
