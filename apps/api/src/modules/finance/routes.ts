import { rememberTransactionCategory } from "./remember-category.js";
import { bulkCategory } from "./bulk-category.js";
import { changeTransactionType } from "./transaction-type.js";
import { bulkDelete } from "./bulk-delete.js";
import { deleteTransaction } from "./delete-transaction.js";
import { Router } from "express";
import { z } from "zod";
import {
  accountSchema,
  ruleSchema,
  budgetSchema,
  scheduleSchema,
  assetSchema,
  valuationSchema,
  forecast,
  netWorth,
  date,
  today,
} from "@finance/shared";
import { prisma, json } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import {
  snapshot,
  validateOwner,
  validateAccount,
  validateCategory,
  createTransaction,
  createTransfer,
  updateTransaction,
  matchOccurrence,
} from "./service.js";
import { saveCategory, removeCategory } from "./categories.js";
export const financeRouter = Router();
financeRouter.get("/snapshot", async (_req, res) => res.json(await snapshot()));
financeRouter.get("/forecast", async (req, res) =>
  res.json(
    forecast(
      await snapshot(),
      z.coerce
        .number()
        .int()
        .min(1)
        .max(365)
        .parse(req.query.days ?? 90),
    ),
  ),
);
financeRouter.get("/net-worth", async (req, res) => {
  const day = date.parse(req.query.date);
  res.json({ date: day, amountCents: netWorth(await snapshot(), day) });
});
financeRouter.post("/accounts", async (req, res) => {
  const input = accountSchema.parse(req.body);
  await validateOwner(prisma, input.owner);
  if (input.openingDate > today())
    throw new HttpError(400, "Choose today or an earlier opening date.");
  res.status(201).json(
    json(
      await prisma.account.create({
        data: {
          ...input,
          openingBalanceCents: BigInt(input.openingBalanceCents),
        },
      }),
    ),
  );
});
financeRouter.put("/accounts/:id", async (req, res) => {
  const id = z.uuid().parse((req.params as Record<string, string>).id);
  const input = accountSchema.parse(req.body);
  await validateOwner(prisma, input.owner);
  if (input.openingDate > today())
    throw new HttpError(400, "Choose today or an earlier opening date.");
  const earlier = await prisma.transaction.findFirst({
    where: { accountId: id, date: { lt: input.openingDate } },
  });
  if (earlier)
    throw new HttpError(
      409,
      "Opening date would exclude existing transactions.",
    );
  res.json(
    json(
      await prisma.account.update({
        where: { id },
        data: {
          ...input,
          openingBalanceCents: BigInt(input.openingBalanceCents),
        },
      }),
    ),
  );
});
financeRouter.post("/transactions", async (req, res) =>
  res
    .status(201)
    .json(
      json(await prisma.$transaction((tx) => createTransaction(tx, req.body))),
    ),
);
financeRouter.put("/transactions/:id", async (req, res) =>
  res.json(
    json(
      await prisma.$transaction((tx) =>
        updateTransaction(
          tx,
          z.uuid().parse((req.params as Record<string, string>).id),
          req.body,
          z.number().int().positive().parse(req.body.version),
        ),
      ),
    ),
  ),
);
financeRouter.post("/transfers", async (req, res) =>
  res
    .status(201)
    .json(await prisma.$transaction((tx) => createTransfer(tx, req.body))),
);
financeRouter.delete("/transactions/:id", async (req, res) => {
  const id = z.uuid().parse((req.params as Record<string, string>).id);
  res.json(await deleteTransaction(id));
});
financeRouter.post("/transactions/remember-category", async (req, res) => {
  res.json(await rememberTransactionCategory(req.body));
});
financeRouter.post("/transactions/bulk-category", async (req, res) => {
  await bulkCategory(req.body);
  res.json({ ok: true });
});
financeRouter.put("/transactions/:id/type", async (req, res) => {
  res.json(
    await changeTransactionType(z.uuid().parse(req.params.id), req.body),
  );
});
financeRouter.post("/transactions/bulk-delete", async (req, res) => {
  res.json(await bulkDelete(req.body));
});
for (const method of ["post", "put"] as const) {
  financeRouter[method](
    method === "post" ? "/categories" : "/categories/:id",
    async (req, res) => {
      res.json(
        await saveCategory(
          req.body,
          method === "put"
            ? z.uuid().parse((req.params as Record<string, string>).id)
            : undefined,
        ),
      );
    },
  );
  financeRouter[method](
    method === "post" ? "/rules" : "/rules/:id",
    async (req, res) => {
      const data = ruleSchema.parse(req.body);
      await validateCategory(prisma, data.categoryId);
      res.json(
        await (method === "post"
          ? prisma.rule.create({ data })
          : prisma.rule.update({
              where: {
                id: z.uuid().parse((req.params as Record<string, string>).id),
              },
              data,
            })),
      );
    },
  );
  financeRouter[method](
    method === "post" ? "/schedules" : "/schedules/:id",
    async (req, res) => {
      const input = scheduleSchema.parse(req.body);
      await validateAccount(prisma, input.accountId);
      await validateOwner(prisma, input.owner);
      await validateCategory(prisma, input.categoryId, input.kind);
      const data = { ...input, amountCents: BigInt(input.amountCents) };
      res.json(
        json(
          await (method === "post"
            ? prisma.schedule.create({ data })
            : prisma.schedule.update({
                where: {
                  id: z.uuid().parse((req.params as Record<string, string>).id),
                },
                data,
              })),
        ),
      );
    },
  );
  financeRouter[method](
    method === "post" ? "/assets" : "/assets/:id",
    async (req, res) => {
      const data = assetSchema.parse(req.body);
      await validateOwner(prisma, data.owner);
      res.json(
        await (method === "post"
          ? prisma.asset.create({ data })
          : prisma.asset.update({
              where: {
                id: z.uuid().parse((req.params as Record<string, string>).id),
              },
              data,
            })),
      );
    },
  );
}
financeRouter.delete("/rules/:id", async (req, res) => {
  await prisma.rule.delete({
    where: { id: z.uuid().parse((req.params as Record<string, string>).id) },
  });
  res.json({ ok: true });
});
financeRouter.put("/budgets", async (req, res) => {
  const input = budgetSchema.parse(req.body);
  await validateCategory(prisma, input.categoryId, "expense");
  const key = { categoryId: input.categoryId, month: input.month };
  res.json(
    json(
      await prisma.budget.upsert({
        where: { categoryId_month: key },
        create: { ...key, amountCents: BigInt(input.amountCents) },
        update: { amountCents: BigInt(input.amountCents) },
      }),
    ),
  );
});
financeRouter.post("/schedules/:id/match", async (req, res) => {
  const input = z
    .object({ date, transactionId: z.uuid().optional() })
    .parse(req.body);
  res.json(
    json(
      await prisma.$transaction((tx) =>
        matchOccurrence(
          tx,
          z.uuid().parse((req.params as Record<string, string>).id),
          input.date,
          input.transactionId,
        ),
      ),
    ),
  );
});
financeRouter.put("/assets/:id/valuations", async (req, res) => {
  const assetId = z.uuid().parse((req.params as Record<string, string>).id);
  const input = valuationSchema.parse(req.body);
  const key = { assetId, date: input.date };
  res.json(
    json(
      await prisma.valuation.upsert({
        where: { assetId_date: key },
        create: { ...key, amountCents: BigInt(input.amountCents) },
        update: { amountCents: BigInt(input.amountCents) },
      }),
    ),
  );
});
financeRouter.delete(
  "/assets/:id/valuations/:valuationId",
  async (req, res) => {
    await prisma.valuation.deleteMany({
      where: {
        assetId: z.uuid().parse((req.params as Record<string, string>).id),
        id: z.uuid().parse(req.params.valuationId),
      },
    });
    res.json({ ok: true });
  },
);

financeRouter.delete("/categories/:id", async (req, res) =>
  res.json(await removeCategory(z.uuid().parse(req.params.id))),
);
