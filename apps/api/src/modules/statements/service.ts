import {
  statementCommitSchema,
  today,
  type StatementDetails,
  type ImportRow,
  type StatementResult,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "../finance/service.js";
import { saveSuggestions } from "./recurring.js";
import { recurringSuggestions } from "./suggestions.js";
import { recoverBalances } from "./balances.js";
import { commitRows } from "../imports/commit.js";
export async function statementPreview(id: string): Promise<StatementResult> {
  const item = await prisma.statement.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      filename: true,
      pages: true,
      details: true,
      status: true,
      stage: true,
      processingError: true,
      importBatch: { select: { preview: true, committedAt: true } },
    },
  });
  if (!item) throw new HttpError(404, "Statement not found.");
  if (item.status !== "ready")
    return json({
      id: item.id,
      accountId: item.accountId,
      filename: item.filename,
      status: item.status,
      stage: item.stage,
      error: item.processingError,
    });
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: item.accountId },
  });
  const rows = json<ImportRow[]>(item.importBatch.preview).map((row) => ({
    ...row,
    owner: account.owner,
  }));
  const details = json<StatementDetails>(item.details);
  if (!item.importBatch.committedAt) {
    details.recurring = recurringSuggestions(rows, item.accountId, today());
    recoverBalances(details, rows, account.type);
  }
  return json({
    status: "ready",
    id: item.id,
    accountId: item.accountId,
    filename: item.filename,
    pages: item.pages,
    rows,
    details,
    committedAt: item.importBatch.committedAt,
  });
}
export async function commitStatement(id: string, body: unknown) {
  const input = statementCommitSchema.parse(body);
  return prisma.$transaction(
    async (tx) => {
      const statement = await tx.statement.findUnique({
        where: { id },
        select: {
          accountId: true,
          importBatchId: true,
          details: true,
          status: true,
        },
      });
      if (!statement) throw new HttpError(404, "Statement not found.");
      if (statement.status !== "ready")
        throw new HttpError(
          409,
          "Wait for statement processing to finish before reviewing it.",
        );
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        statement.accountId,
      );
      const batch = await tx.importBatch.findUniqueOrThrow({
        where: { id: statement.importBatchId },
      });
      const previous = await tx.importBatch.findFirst({
        where: {
          accountId: batch.accountId,
          fileHash: batch.fileHash,
          committedAt: { not: null },
        },
      });
      if (previous)
        return {
          imported: await tx.transaction.count({
            where: { importBatchId: previous.id, sourceRow: { not: null } },
          }),
          alreadyImported: true,
        };
      const details = json<StatementDetails>(statement.details);
      const sourceRows = json<ImportRow[]>(batch.preview);
      details.recurring = recurringSuggestions(
        sourceRows,
        statement.accountId,
        today(),
      );
      const account = await validateAccount(tx, statement.accountId);
      recoverBalances(details, sourceRows, account.type);
      if (input.applyOpening) {
        if (!input.opening || input.opening.date > today())
          throw new HttpError(400, "Confirm an opening date and balance.");
        if (await tx.transaction.count({ where: { accountId: account.id } }))
          throw new HttpError(
            409,
            "Opening balance can only be imported into an empty account. Existing history is preserved.",
          );
        if (
          details.opening &&
          input.opening.amountCents !== details.opening.amountCents
        )
          throw new HttpError(
            400,
            "Opening balance must match the extracted statement.",
          );
        const firstDate = input.rows
          .filter((r) => r.include)
          .map((r) => r.date)
          .sort()[0];
        if (firstDate && input.opening.date > firstDate)
          throw new HttpError(
            400,
            `Set the opening date to ${firstDate} or earlier. The opening balance is before the first listed transaction, even if it predates the statement period.`,
          );
        await tx.account.update({
          where: { id: account.id },
          data: {
            openingDate: input.opening.date,
            openingBalanceCents: BigInt(input.opening.amountCents),
          },
        });
      }
      const imported = await commitRows(tx, batch, input);
      await saveSuggestions(
        tx,
        account.id,
        input.rows,
        details.recurring,
        input.schedules,
      );
      await tx.importBatch.update({
        where: { id: batch.id },
        data: { committedAt: new Date() },
      });
      return { imported, alreadyImported: false };
    },
    { timeout: 60000 },
  );
}
