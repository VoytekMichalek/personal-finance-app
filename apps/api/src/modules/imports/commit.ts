import {
  date as dateSchema,
  commitImportSchema,
  type ImportRow,
} from "@finance/shared";
import type { z } from "zod";
import type { Prisma, ImportBatch } from "@prisma/client";
import { json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import {
  createTransaction,
  createTransfer,
  validateOwner,
} from "../finance/service.js";
export async function commitRows(
  tx: Prisma.TransactionClient,
  batch: ImportBatch,
  input: z.infer<typeof commitImportSchema>,
) {
  const original = json<ImportRow[]>(batch.preview);
  const seen = new Set<number>();
  let imported = 0;
  for (const row of input.rows) {
    if (seen.has(row.rowNumber))
      throw new HttpError(400, "A source row was supplied twice.");
    seen.add(row.rowNumber);
    if (!row.include) continue;
    const source = original.find((r) => r.rowNumber === row.rowNumber);
    if (
      !source ||
      source.error ||
      row.amountCents !== source.amountCents ||
      row.date !== source.date
    )
      throw new HttpError(
        400,
        "Source amounts and dates must match the preview. Correct the mapping and preview again.",
      );
    dateSchema.parse(row.date);
    const duplicate = await tx.transaction.findFirst({
      where: {
        accountId: batch.accountId,
        date: row.date,
        amountCents: BigInt(row.amountCents),
        OR: [{ importBatchId: null }, { importBatchId: { not: batch.id } }],
      },
    });
    if (duplicate && !row.allowDuplicate)
      throw new HttpError(
        409,
        "A selected row may be a duplicate. Review and explicitly retain it if correct.",
      );
    const kind = row.kind ?? (row.amountCents < 0 ? "expense" : "income");
    if (kind === "transfer") {
      if (!row.counterAccountId || row.counterAccountId === batch.accountId)
        throw new HttpError(
          400,
          "Choose a different account for each transfer.",
        );
      const counterpart = await tx.transaction.findFirst({
        where: {
          accountId: row.counterAccountId,
          date: row.date,
          amountCents: BigInt(-row.amountCents),
        },
      });
      if (counterpart && !row.allowDuplicate)
        throw new HttpError(
          409,
          "A matching payment already exists in the other account. Check it before importing: if it is already a linked transfer, skip this statement row; otherwise correct that payment to a transfer first.",
        );
      await validateOwner(tx, row.owner);
      await createTransfer(
        tx,
        {
          fromAccountId:
            row.amountCents < 0 ? batch.accountId : row.counterAccountId,
          toAccountId:
            row.amountCents < 0 ? row.counterAccountId : batch.accountId,
          amountCents: Math.abs(row.amountCents),
          date: row.date,
          description: row.description,
        },
        {
          accountId: batch.accountId,
          importBatchId: batch.id,
          sourceRow: row.rowNumber,
          owner: row.owner,
        },
      );
    } else {
      if ((kind === "expense") !== row.amountCents < 0)
        throw new HttpError(
          400,
          "Transaction type must agree with the source amount.",
        );
      await createTransaction(
        tx,
        {
          ...row,
          amountCents: Math.abs(row.amountCents),
          accountId: batch.accountId,
          kind,
          notes: "",
        },
        { importBatchId: batch.id, sourceRow: row.rowNumber },
      );
    }
    imported++;
  }
  if (!imported)
    throw new HttpError(400, "Select at least one valid row to import.");

  return imported;
}
