import { categoryColoursSchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";

export async function saveCategoryColours(input: unknown) {
  const { changes } = categoryColoursSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    // Share the category edit lock: batch changes and undo never overwrite a concurrent edit.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164232)");
    const current = await tx.category.findMany({
      where: { id: { in: changes.map((c) => c.id) } },
    });
    if (
      current.length !== changes.length ||
      changes.some(
        (c) =>
          current.find((r) => r.id === c.id)?.color.toLowerCase() !==
          c.expectedColor.toLowerCase(),
      )
    )
      throw new HttpError(
        409,
        "A category colour changed. Refresh data and review the current colours before trying again.",
      );
    for (const change of changes)
      await tx.category.update({
        where: { id: change.id },
        data: { color: change.color },
      });
    return { changed: changes.length };
  });
}
