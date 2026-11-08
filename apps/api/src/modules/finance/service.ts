import { randomUUID } from "node:crypto";
import {
  today,
  matchesRule,
  compareRules,
  type Snapshot,
  transactionSchema,
  transferSchema,
} from "@finance/shared";
import { type DB, prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
export async function snapshot(): Promise<Snapshot> {
  const [
    accounts,
    categories,
    transactions,
    rules,
    budgets,
    budgetOverrides,
    schedules,
    assets,
    people,
    institutions,
  ] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.rule.findMany({ orderBy: [{ priority: "asc" }, { id: "asc" }] }),
    prisma.budget.findMany(),
    prisma.budgetOverride.findMany(),
    prisma.schedule.findMany(),
    prisma.asset.findMany({
      include: { valuations: true, account: { select: { id: true } } },
    }),
    prisma.user.findMany({
      where: { state: { not: "pending" } },
      select: { id: true, name: true, email: true, role: true, state: true },
    }),
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        logoDataUrl: true,
      },
    }),
  ]);
  return json({
    accounts,
    categories,
    transactions,
    rules,
    budgets,
    budgetOverrides,
    schedules,
    assets: assets.map(({ account, ...asset }) => ({
      ...asset,
      accountId: account?.id ?? null,
    })),
    people,
    institutions,
    today: today(),
  });
}
export async function validateOwner(db: DB, owner: string) {
  if (
    owner !== "household" &&
    !(await db.user.findUnique({ where: { id: owner } }))
  )
    throw new HttpError(400, "Choose a household member.");
}
export async function validateAccount(db: DB, id: string, date?: string) {
  const account = await db.account.findUnique({ where: { id } });
  if (!account) throw new HttpError(404, "Account not found.");
  if (account.archived) throw new HttpError(409, "This account is archived.");
  if (date && date < account.openingDate)
    throw new HttpError(
      400,
      `The transaction on ${date} is before ${account.name}’s opening date (${account.openingDate}). Update that account’s opening date and balance to cover this history, or exclude the transaction.`,
    );
  return account;
}
export async function validateCategory(
  db: DB,
  id: string | null,
  kind?: string,
) {
  if (!id) return;
  const category = await db.category.findUnique({ where: { id } });
  if (!category || category.archived)
    throw new HttpError(400, "Choose an active category.");
  if (kind && category.kind !== (kind === "income" ? "income" : "expense"))
    throw new HttpError(
      400,
      "The category does not match the transaction type.",
    );
}
export async function validateImportAccount(db: DB, id: string) {
  const account = await validateAccount(db, id);
  if (account.assetId)
    throw new HttpError(
      400,
      "Choose a bank, cash or credit account for statement imports. Mark transfers to your asset or liability during review.",
    );
  return account;
}
export async function applyRule(
  db: DB,
  description: string,
  kind: string,
): Promise<string | null> {
  const rules = await db.rule.findMany({
    where: {
      enabled: true,
      category: {
        archived: false,
        kind: kind === "income" ? "income" : "expense",
      },
    },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });
  return (
    rules.sort(compareRules).find((rule) => matchesRule(description, rule))
      ?.categoryId ?? null
  );
}
export async function createTransaction(
  db: DB,
  body: unknown,
  extra: {
    scheduleId?: string;
    occurrenceDate?: string;
    importBatchId?: string;
    sourceRow?: number;
  } = {},
) {
  const input = transactionSchema.parse(body);
  const account = await validateAccount(db, input.accountId, input.date);
  if (body && typeof body === "object" && !Object.hasOwn(body, "owner"))
    input.owner = account.owner;
  await validateOwner(db, input.owner);
  if (input.date > today())
    throw new HttpError(400, "Use a schedule for future transactions.");
  const categoryId =
    body && typeof body === "object" && Object.hasOwn(body, "categoryId")
      ? input.categoryId
      : await applyRule(db, input.description, input.kind);
  await validateCategory(db, categoryId, input.kind);
  return db.transaction.create({
    data: {
      ...input,
      ...extra,
      categoryId,
      amountCents: BigInt(
        input.amountCents * (input.kind === "expense" ? -1 : 1),
      ),
    },
  });
}
export async function createTransfer(
  db: DB,
  body: unknown,
  source?: {
    accountId: string;
    importBatchId?: string;
    sourceRow?: number;
    owner: string;
    scheduleId?: string;
    occurrenceDate?: string;
  },
) {
  const input = transferSchema.parse(body);
  if (input.date > today())
    throw new HttpError(400, "Choose today or an earlier date.");
  const from = await validateAccount(db, input.fromAccountId, input.date);
  const to = await validateAccount(db, input.toAccountId, input.date);
  const transferGroupId = randomUUID();
  for (const [account, sign] of [
    [from, -1],
    [to, 1],
  ] as const)
    await db.transaction.create({
      data: {
        ...(source && account.id === source.accountId
          ? {
              importBatchId: source.importBatchId,
              sourceRow: source.sourceRow,
              scheduleId: source.scheduleId,
              occurrenceDate: source.occurrenceDate,
            }
          : {}),
        accountId: account.id,
        kind: "transfer",
        amountCents: BigInt(sign * input.amountCents),
        date: input.date,
        description: input.description,
        owner: source?.owner ?? account.owner,
        transferGroupId,
      },
    });
  return { transferGroupId };
}
export async function updateTransaction(
  db: DB,
  id: string,
  body: unknown,
  version: number,
) {
  const current = await db.transaction.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, "Transaction not found.");
  if (current.transferGroupId)
    throw new HttpError(
      400,
      "Delete and recreate a transfer to change both linked entries.",
    );
  const input = transactionSchema.parse(body);
  await validateAccount(db, input.accountId, input.date);
  await validateOwner(db, input.owner);
  await validateCategory(db, input.categoryId, input.kind);
  if (input.date > today())
    throw new HttpError(400, "Use a schedule for future transactions.");
  const result = await db.transaction.updateMany({
    where: { id, version },
    data: {
      ...input,
      amountCents: BigInt(
        input.amountCents * (input.kind === "expense" ? -1 : 1),
      ),
      version: { increment: 1 },
    },
  });
  if (!result.count)
    throw new HttpError(
      409,
      "This transaction changed. Refresh before editing it again.",
    );
  return db.transaction.findUnique({ where: { id } });
}
