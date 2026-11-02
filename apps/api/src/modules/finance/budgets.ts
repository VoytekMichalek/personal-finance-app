import {
  budgetSchema,
  budgetOverrideSchema,
  shiftMonth,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { validateCategory } from "./service.js";

export async function saveBudget(body: unknown) {
  const input = budgetSchema.parse(body);
  const endMonth = shiftMonth(input.month, input.repeatMonths - 1);
  if (endMonth.length !== 7)
    throw new HttpError(
      400,
      "Choose an earlier start month or fewer repeating months.",
    );
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164232)");
    await validateCategory(tx, input.categoryId, "expense");
    const key = { categoryId: input.categoryId, month: input.month };
    const values = { amountCents: BigInt(input.amountCents), endMonth };
    return json(
      await tx.budget.upsert({
        where: { categoryId_month: key },
        create: { ...key, ...values },
        update: values,
      }),
    );
  });
}

export async function overrideBudget(body: unknown) {
  const input = budgetOverrideSchema.parse(body);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164232)");
    await validateCategory(tx, input.categoryId, "expense");
    const plan = await tx.budget.findFirst({
      where: {
        categoryId: input.categoryId,
        month: { lte: input.month },
        OR: [{ endMonth: null }, { endMonth: { gte: input.month } }],
      },
    });
    const key = { categoryId: input.categoryId, month: input.month };
    const existing = await tx.budgetOverride.findUnique({
      where: { categoryId_month: key },
    });
    if (!plan && !existing)
      throw new HttpError(
        400,
        "Set a budget for this month before overriding it.",
      );
    return json(
      await tx.budgetOverride.upsert({
        where: { categoryId_month: key },
        create: { ...key, amountCents: BigInt(input.amountCents) },
        update: { amountCents: BigInt(input.amountCents) },
      }),
    );
  });
}

export async function restoreBudget(id: string) {
  await prisma.budgetOverride.deleteMany({ where: { id } });
  return { ok: true };
}
