import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { bulkDelete } from "./bulk-delete.js";

export async function deleteTransaction(id: string) {
  const record = await prisma.transaction.findUnique({
    where: { id },
    select: { id: true, version: true, transferGroupId: true },
  });
  if (!record) throw new HttpError(404, "Transaction not found.");
  const records = record.transferGroupId
    ? await prisma.transaction.findMany({
        where: { transferGroupId: record.transferGroupId },
        select: { id: true, version: true },
      })
    : [{ id: record.id, version: record.version }];
  if (!records.length)
    throw new HttpError(
      409,
      "This transaction changed. Refresh before deleting it again.",
    );
  // The same optimistic guard protects a single deletion if an import links the
  // payment after this read. Never delete just one side of that new transfer.
  await bulkDelete({ records });
  return { ok: true };
}
