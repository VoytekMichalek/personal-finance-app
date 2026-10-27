import { bulkDeleteSchema } from "@finance/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";

const changed = () =>
  new HttpError(
    409,
    "A selected transaction or linked transfer changed. Refresh and review your selection again.",
  );

export async function bulkDelete(body: unknown) {
  const input = bulkDeleteSchema.parse(body);
  // Sort to give overlapping bulk requests a consistent lock order.
  const records = [...input.records].sort((a, b) => a.id.localeCompare(b.id));
  const ids = records.map((row) => row.id);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.transaction.findMany({
          where: { id: { in: ids } },
          select: { id: true, transferGroupId: true },
        });
        if (rows.length !== records.length) throw changed();
        const groups = [
          ...new Set(
            rows.flatMap((row) =>
              row.transferGroupId ? [row.transferGroupId] : [],
            ),
          ),
        ];
        // The confirmation must include every counterpart, including its version.
        // Never silently expand a destructive action after the user approved it.
        const unconfirmed =
          groups.length &&
          (await tx.transaction.count({
            where: { transferGroupId: { in: groups }, id: { notIn: ids } },
          }));
        if (unconfirmed) throw changed();
        if (await tx.receipt.count({ where: { transactionId: { in: ids } } }))
          throw new HttpError(
            409,
            "Remove attached receipts from the selected transactions and linked transfers before deleting. Nothing was deleted.",
          );
        for (let offset = 0; offset < records.length; offset += 500) {
          const chunk = records.slice(offset, offset + 500);
          const deleted = await tx.transaction.deleteMany({
            where: { OR: chunk },
          });
          if (deleted.count !== chunk.length) throw changed();
        }
        return { deletedCount: records.length };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw changed();
    throw error;
  }
}
