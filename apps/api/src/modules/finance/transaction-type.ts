import { randomUUID } from "node:crypto";
import { transactionTypeSchema } from "@finance/shared";
import type { Prisma, Transaction } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateAccount } from "./service.js";

const changed = () =>
  new HttpError(
    409,
    "This transaction or its linked payment changed. Review the refreshed rows and try again.",
  );
const standalone = (row: Transaction) =>
  !row.transferGroupId &&
  !row.scheduleId &&
  !row.occurrenceDate &&
  row.kind !== "transfer";
const signedAmount = (row: Transaction, kind: string) => {
  const amount = row.amountCents < 0n ? -row.amountCents : row.amountCents;
  return kind === "expense" ? -amount : amount;
};
async function categoryFor(
  tx: Prisma.TransactionClient,
  row: Transaction,
  kind: string,
) {
  if (!row.categoryId) return null;
  const category = await tx.category.findUnique({
    where: { id: row.categoryId },
  });
  return category?.kind === (kind === "income" ? "income" : "expense")
    ? row.categoryId
    : null;
}

export async function changeTransactionType(id: string, body: unknown) {
  return prisma.$transaction((tx) => applyTransactionType(tx, id, body));
}
export async function applyTransactionType(
  tx: Prisma.TransactionClient,
  id: string,
  body: unknown,
) {
  const input = transactionTypeSchema.parse(body);
  const current = await tx.transaction.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Transaction not found.");
  if (current.version !== input.version) throw changed();
  if (current.kind === input.kind) return { ok: true };
  if (current.scheduleId || current.occurrenceDate)
    throw new HttpError(
      409,
      "This payment is linked to a scheduled item and cannot change type.",
    );
  if (current.kind !== "transfer" && current.transferGroupId) throw changed();
  await validateAccount(tx, current.accountId, current.date);
  const updates: {
    row: Transaction;
    data: Prisma.TransactionUncheckedUpdateManyInput;
  }[] = [];
  if (input.kind === "transfer") {
    if (!input.counterAccountId || input.counterAccountId === current.accountId)
      throw new HttpError(400, "Choose the other account for this transfer.");
    const account = await validateAccount(
      tx,
      input.counterAccountId,
      current.date,
    );
    if (!!input.linkExisting === input.createCounterpart)
      throw new HttpError(
        400,
        "Choose an existing payment to link, or explicitly create the other entry.",
      );
    const transferGroupId = randomUUID();
    const transfer = { kind: "transfer", categoryId: null, transferGroupId };
    if (input.linkExisting) {
      const other = await tx.transaction.findUnique({
        where: { id: input.linkExisting.id },
      });
      if (
        !other ||
        other.version !== input.linkExisting.version ||
        !standalone(other) ||
        other.accountId !== account.id ||
        other.date !== current.date ||
        other.amountCents !== -current.amountCents
      )
        throw changed();
      updates.push({ row: other, data: transfer });
    } else {
      await tx.transaction.create({
        data: {
          ...transfer,
          accountId: account.id,
          amountCents: -current.amountCents,
          date: current.date,
          description: current.description,
          owner: account.owner,
        },
      });
    }
    updates.push({ row: current, data: transfer });
  } else {
    if (current.kind === "transfer") {
      const pair = current.transferGroupId
        ? await tx.transaction.findMany({
            where: { transferGroupId: current.transferGroupId },
          })
        : [];
      const other = pair.find((row) => row.id !== id);
      const choice = input.unlinkCounterpart;
      if (
        pair.length !== 2 ||
        !other ||
        !choice ||
        choice.id !== other.id ||
        choice.version !== other.version ||
        other.kind !== "transfer" ||
        other.scheduleId ||
        other.occurrenceDate ||
        other.amountCents !== -current.amountCents
      )
        throw changed();
      // Reclassification preserves both recorded payments, including receipts and source attribution.
      if ((choice.kind === "expense") !== other.amountCents < 0n)
        throw new HttpError(
          400,
          "Keep the linked payment's original money-in or money-out direction.",
        );
      await validateAccount(tx, other.accountId, other.date);
      updates.push({
        row: other,
        data: { kind: choice.kind, transferGroupId: null, categoryId: null },
      });
    }
    updates.push({
      row: current,
      data: {
        kind: input.kind,
        amountCents: signedAmount(current, input.kind),
        transferGroupId: null,
        categoryId: await categoryFor(tx, current, input.kind),
      },
    });
  }
  // A stable lock order also handles two concurrent requests linking opposite sides.
  for (const { row, data } of updates.sort((a, b) =>
    a.row.id.localeCompare(b.row.id),
  )) {
    const result = await tx.transaction.updateMany({
      where: {
        id: row.id,
        version: row.version,
        transferGroupId: row.transferGroupId,
        scheduleId: null,
        occurrenceDate: null,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count !== 1) throw changed();
  }
  return { ok: true };
}
