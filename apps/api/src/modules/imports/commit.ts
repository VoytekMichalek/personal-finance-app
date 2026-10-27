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
import { checkImportConflicts, type ApprovedImportRow } from "./conflicts.js";
import { linkImportedPayment } from "./link-payment.js";
export async function commitRows(
  tx: Prisma.TransactionClient,
  batch: ImportBatch,
  input: z.infer<typeof commitImportSchema>,
) {
  const original = new Map(
    json<ImportRow[]>(batch.preview).map((row) => [row.rowNumber, row]),
  );
  const seen = new Set<number>();
  const approved: ApprovedImportRow[] = [];
  for (const row of input.rows) {
    if (seen.has(row.rowNumber))
      throw new HttpError(400, "A source row was supplied twice.");
    seen.add(row.rowNumber);
    if (!row.include) continue;
    const source = original.get(row.rowNumber);
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
    const kind = row.kind ?? (row.amountCents < 0 ? "expense" : "income");
    if (kind === "transfer") {
      if (!row.counterAccountId || row.counterAccountId === batch.accountId)
        throw new HttpError(
          400,
          "Choose a different account for each transfer.",
        );
    } else if ((kind === "expense") !== row.amountCents < 0) {
      throw new HttpError(
        400,
        "Transaction type must agree with the source amount.",
      );
    }
    approved.push({ ...row, kind });
  }
  if (!approved.length)
    throw new HttpError(400, "Select at least one valid row to import.");

  // Collect every existing-payment conflict before any ledger entry is changed.
  await checkImportConflicts(tx, batch, approved);
  for (const row of approved) {
    const kind = row.kind!;
    if (kind === "transfer" && row.linkExisting) {
      await linkImportedPayment(tx, batch, row);
    } else if (kind === "transfer") {
      await validateOwner(tx, row.owner);
      await createTransfer(
        tx,
        {
          fromAccountId:
            row.amountCents < 0 ? batch.accountId : row.counterAccountId!,
          toAccountId:
            row.amountCents < 0 ? row.counterAccountId! : batch.accountId,
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
  }
  return approved.length;
}
