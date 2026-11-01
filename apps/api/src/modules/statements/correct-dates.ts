import {
  hasStatementDateError,
  importRowSchema,
  statementDate,
  statementDateCorrectionSchema,
  statementRowDateText,
  today,
  type ImportRow,
  type StatementDetails,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "../finance/service.js";
import { recoverBalances } from "./balances.js";
import { statementPreview } from "./service.js";

export async function correctStatementDates(id: string, body: unknown) {
  const { corrections } = statementDateCorrectionSchema.parse(body);
  if (
    new Set(corrections.map((row) => row.rowNumber)).size !== corrections.length
  )
    throw new HttpError(400, "Choose each statement row only once.");
  await prisma.$transaction(async (tx) => {
    const initial = await tx.statement.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!initial)
      throw new HttpError(
        404,
        "Statement not found. Return to the account and choose a saved statement.",
      );
    // Serialize corrections with commits and rereads; never change posted source evidence.
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      initial.accountId,
    );
    const saved = await tx.statement.findUniqueOrThrow({
      where: { id },
      include: { importBatch: true },
    });
    if (saved.status !== "ready" || saved.importBatch.committedAt)
      throw new HttpError(
        409,
        "Only a ready, unimported statement can have its dates corrected. Refresh the review.",
      );
    const account = await validateAccount(tx, saved.accountId);
    const rows = json<ImportRow[]>(saved.importBatch.preview);
    const details = json<StatementDetails>(saved.details);
    const history = await tx.transaction.findMany({
      where: { accountId: saved.accountId },
      select: { date: true, amountCents: true },
    });
    for (const correction of corrections) {
      const row = rows.find((item) => item.rowNumber === correction.rowNumber);
      if (!row || !hasStatementDateError(row))
        throw new HttpError(
          409,
          `Row ${correction.rowNumber} has changed or already has a valid date. Refresh the review.`,
        );
      const printed = statementRowDateText(details, row.rowNumber);
      let verified: string | undefined;
      try {
        if (printed)
          verified = statementDate(
            printed,
            Number(correction.date.slice(0, 4)),
          );
      } catch {
        /* Report a usable source-specific message below, not a Zod stack. */
      }
      if (verified !== correction.date)
        throw new HttpError(
          400,
          `Row ${row.rowNumber}: keep the day and month printed in the PDF (${printed ?? "unreadable"}). Choose its year, or review the source and read the statement again.`,
        );
      if (verified > today())
        throw new HttpError(
          400,
          `Row ${row.rowNumber}: the corrected date is in the future. Choose an earlier year or leave this row excluded.`,
        );
      if (!importRowSchema.safeParse({ ...row, date: verified }).success)
        throw new HttpError(
          400,
          `Row ${row.rowNumber} also has an unreadable description or amount. Review the source PDF and read it again, or leave this row excluded.`,
        );
      row.date = verified;
      row.error = null;
      row.duplicate = history.some(
        (item) =>
          item.date === verified &&
          Number(item.amountCents) === row.amountCents,
      );
      row.include = !row.duplicate;
      row.allowDuplicate = false;
      delete row.linkExisting;
      delete row.reconcileExisting;
      for (const line of details.lines)
        if (line.rowNumber === row.rowNumber) line.status = "transaction";
    }
    // The recorded amounts remain untouched. Recover previously undated balances
    // only from labelled source lines, using the newly verified date range.
    const dates = rows
      .map((row) => row.date)
      .filter(Boolean)
      .sort();
    if (details.opening && dates[0]) details.opening.date = dates[0];
    if (details.closing && dates.at(-1)) details.closing.date = dates.at(-1)!;
    recoverBalances(details, rows, account.type);
    await tx.importBatch.update({
      where: { id: saved.importBatchId },
      data: {
        preview: json(rows),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await tx.statement.update({
      where: { id },
      data: { details: json(details) },
    });
  });
  return statementPreview(id);
}
