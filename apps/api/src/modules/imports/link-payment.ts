import { randomUUID } from "node:crypto";
import { today } from "@finance/shared";
import type { Prisma } from "@prisma/client";
import { HttpError } from "../../lib/errors.js";
import { validateAccount, validateOwner } from "../finance/service.js";
import {
  conflictMatch,
  importConflictError,
  type ApprovedImportRow,
} from "./conflicts.js";

export async function linkImportedPayment(
  tx: Prisma.TransactionClient,
  batch: { id: string; accountId: string },
  row: ApprovedImportRow,
) {
  if (
    !row.linkExisting ||
    !row.counterAccountId ||
    row.counterAccountId === batch.accountId
  )
    throw new HttpError(400, "Choose a different account for each transfer.");
  if (row.date > today())
    throw new HttpError(400, "Choose today or an earlier date.");
  await validateAccount(tx, batch.accountId, row.date);
  await validateAccount(tx, row.counterAccountId, row.date);
  await validateOwner(tx, row.owner);
  const transferGroupId = randomUUID();
  const linked = await tx.transaction.updateMany({
    where: {
      id: row.linkExisting.id,
      version: row.linkExisting.version,
      accountId: row.counterAccountId,
      date: row.date,
      amountCents: BigInt(-row.amountCents),
      kind: { in: ["income", "expense", "refund"] },
      transferGroupId: null,
      scheduleId: null,
      occurrenceDate: null,
    },
    data: {
      kind: "transfer",
      categoryId: null,
      transferGroupId,
      version: { increment: 1 },
    },
  });
  if (linked.count !== 1) {
    const current = await tx.transaction.findUnique({
      where: { id: row.linkExisting.id },
    });
    throw importConflictError([
      {
        rowNumber: row.rowNumber,
        reason: "stale-link",
        matches: current ? [conflictMatch(current)] : [],
      },
    ]);
  }
  // Only the source side is new. The counterpart keeps its identity, source
  // attribution, owner, notes, dates, amounts and attached receipts unchanged.
  await tx.transaction.create({
    data: {
      accountId: batch.accountId,
      kind: "transfer",
      amountCents: BigInt(row.amountCents),
      date: row.date,
      description: row.description,
      owner: row.owner,
      transferGroupId,
      importBatchId: batch.id,
      sourceRow: row.rowNumber,
    },
  });
}
