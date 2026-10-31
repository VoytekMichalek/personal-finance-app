import { Prisma } from "@prisma/client";
import {
  canMatchSchedule,
  scheduleDates,
  scheduleSchema,
  type Schedule,
  type Transaction,
} from "@finance/shared";
import { type DB, prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import {
  createTransaction,
  createTransfer,
  validateAccount,
  validateCategory,
  validateOwner,
} from "./service.js";
import type { z } from "zod";

export async function validateSchedule(
  db: DB,
  input: z.output<typeof scheduleSchema>,
) {
  await validateAccount(
    db,
    input.accountId,
    input.kind === "transfer" ? input.startDate : undefined,
  );
  if (input.kind === "transfer")
    await validateAccount(db, input.counterAccountId!, input.startDate);
  await validateOwner(db, input.owner);
  await validateCategory(db, input.categoryId, input.kind);
}

export async function saveSchedule(body: unknown, id?: string) {
  const input = scheduleSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    await validateSchedule(tx, input);
    const data = { ...input, amountCents: BigInt(input.amountCents) };
    return id
      ? tx.schedule.update({ where: { id }, data })
      : tx.schedule.create({ data });
  });
}

export async function matchOccurrence(
  db: DB,
  id: string,
  date: string,
  transactionId?: string,
) {
  // Serialize recording/matching with edits to this schedule.
  await db.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Schedule" WHERE "id" = ${id} FOR UPDATE`,
  );
  const record = await db.schedule.findUnique({ where: { id } });
  if (!record) throw new HttpError(404, "Schedule not found.");
  const schedule = json<Schedule>(record);
  if (!scheduleDates(schedule, date, date).includes(date))
    throw new HttpError(400, "This date is not a scheduled occurrence.");
  if (
    await db.transaction.findFirst({
      where: { scheduleId: id, occurrenceDate: date },
    })
  )
    throw new HttpError(409, "This occurrence is already recorded.");
  if (!transactionId) {
    if (schedule.kind === "transfer")
      return createTransfer(
        db,
        {
          fromAccountId: schedule.accountId,
          toAccountId: schedule.counterAccountId,
          amountCents: schedule.amountCents,
          date,
          description: schedule.name,
        },
        {
          accountId: schedule.accountId,
          owner: schedule.owner,
          scheduleId: id,
          occurrenceDate: date,
        },
      );
    return createTransaction(
      db,
      { ...schedule, date, description: schedule.name },
      { scheduleId: id, occurrenceDate: date },
    );
  }
  const initial = await db.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!initial) throw new HttpError(409, "Choose an unmatched transaction.");
  const where = initial.transferGroupId
    ? { transferGroupId: initial.transferGroupId }
    : { id: transactionId };
  const ids = (await db.transaction.findMany({ where, select: { id: true } }))
    .map((row) => row.id)
    .sort();
  if (!ids.length)
    throw new HttpError(
      409,
      "This transaction changed. Refresh and try again.",
    );
  await db.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Transaction" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`,
  );
  const rows = json<Transaction[]>(await db.transaction.findMany({ where }));
  const existing = rows.find((row) => row.id === transactionId);
  if (!existing || !canMatchSchedule(existing, schedule, rows))
    throw new HttpError(
      400,
      "Match an unrecorded payment with the same accounts, type and amount.",
    );
  await validateAccount(db, schedule.accountId, existing.date);
  if (schedule.counterAccountId)
    await validateAccount(db, schedule.counterAccountId, existing.date);
  const matched = await db.transaction.updateMany({
    where: {
      id: transactionId,
      scheduleId: null,
      occurrenceDate: null,
      version: existing.version,
    },
    data: { scheduleId: id, occurrenceDate: date, version: { increment: 1 } },
  });
  if (!matched.count)
    throw new HttpError(
      409,
      "This transaction was matched or edited. Refresh and try again.",
    );
  return { ok: true };
}
