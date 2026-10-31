import request from "supertest";
import { expect, it, vi } from "vitest";
import { today } from "@finance/shared";
import { account, post, origin } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";

async function setup(count = 2) {
  const accounts = await Promise.all([account(), account()]);
  const groceries = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  await prisma.transaction.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      accountId: accounts[index % 2]!,
      date: today(),
      amountCents: index % 3 === 0 ? 100n : -100n,
      kind: index % 3 === 0 ? "refund" : "expense",
      description: `Local Shop ${index}`,
      notes: "Keep this note",
      categoryId: index % 5 === 0 ? dining.id : null,
    })),
  });
  const rows = await prisma.transaction.findMany({ orderBy: { id: "asc" } });
  const input = {
    source: { id: rows[0]!.id, version: 1 },
    records: rows.map(({ id, version }) => ({ id, version })),
    categoryId: groceries.id,
    pattern: "local shop",
    matchMode: "contains",
  };
  return { accounts, groceries, dining, rows, input };
}

it("categorises 800 existing payments across accounts and pages and saves a reusable rule", async () => {
  const { accounts, groceries, rows, input } = await setup(800);
  await prisma.transaction.createMany({
    data: [
      {
        accountId: accounts[0]!,
        date: today(),
        amountCents: 100n,
        kind: "income",
        description: "Local Shop salary",
      },
      {
        accountId: accounts[0]!,
        date: today(),
        amountCents: -100n,
        kind: "transfer",
        description: "Local Shop transfer",
      },
      {
        accountId: accounts[0]!,
        date: today(),
        amountCents: -100n,
        kind: "expense",
        description: "Another shop",
      },
    ],
  });
  await prisma.receipt.create({
    data: {
      transactionId: rows[0]!.id,
      objectKey: "ledger-receipt",
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      size: 10,
    },
  });
  const result = await post("/transactions/remember-category", input);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({
    matched: 800,
    changed: 800,
    rule: {
      categoryId: groceries.id,
      pattern: "local shop",
      matchMode: "contains",
    },
  });
  expect(
    await prisma.transaction.count({ where: { categoryId: groceries.id } }),
  ).toBe(800);
  expect(await prisma.transaction.count({ where: { categoryId: null } })).toBe(
    3,
  );
  for (const before of rows) {
    const after = await prisma.transaction.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after).toMatchObject({
      accountId: before.accountId,
      kind: before.kind,
      date: before.date,
      amountCents: before.amountCents,
      description: before.description,
      notes: before.notes,
      version: 2,
    });
  }
  expect(await prisma.receipt.count()).toBe(1);
  const future = await post("/transactions", {
    accountId: accounts[0],
    date: today(),
    amountCents: 700,
    kind: "expense",
    description: "Local Shop future",
  });
  expect(future.body.categoryId).toBe(groceries.id);
});

it("rejects stale, incomplete, extra, invalid and unauthenticated requests without saving a rule", async () => {
  const { input, rows } = await setup();
  expect(
    (
      await request(app)
        .post("/api/transactions/remember-category")
        .set("Origin", origin)
        .send(input)
    ).status,
  ).toBe(401);
  expect(
    (
      await post("/transactions/remember-category", {
        ...input,
        records: input.records.slice(0, 1),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await post("/transactions/remember-category", {
        ...input,
        pattern: "Wrong merchant",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post("/transactions/remember-category", {
        ...input,
        records: [...input.records, input.records[0]],
      })
    ).status,
  ).toBe(400);
  const salary = await prisma.category.findFirstOrThrow({
    where: { name: "Salary" },
  });
  expect(
    (
      await post("/transactions/remember-category", {
        ...input,
        categoryId: salary.id,
      })
    ).status,
  ).toBe(400);
  await prisma.transaction.update({
    where: { id: rows[1]!.id },
    data: { version: { increment: 1 } },
  });
  expect((await post("/transactions/remember-category", input)).status).toBe(
    409,
  );
  expect(await prisma.rule.count()).toBe(0);
  expect(
    await prisma.transaction.findUnique({ where: { id: rows[0]!.id } }),
  ).toMatchObject({ categoryId: rows[0]!.categoryId, version: 1 });
});

it("rolls back every category chunk if rule persistence fails and can recover without duplicates", async () => {
  const { input, rows, groceries } = await setup(620);
  const original = prisma.$transaction.bind(prisma);
  const create = vi.spyOn(prisma, "$transaction");
  // Inject a persistence failure inside the real database transaction, after category updates.
  create.mockImplementationOnce(((
    callback: (tx: typeof prisma) => Promise<unknown>,
    options: object,
  ) =>
    original(async (tx) => {
      const wrapped = Object.create(tx);
      wrapped.rule = {
        ...tx.rule,
        create: () => {
          throw new Error("Synthetic rule persistence failure");
        },
      };
      return callback(wrapped);
    }, options)) as typeof prisma.$transaction);
  try {
    expect((await post("/transactions/remember-category", input)).status).toBe(
      500,
    );
  } finally {
    create.mockRestore();
  }
  expect(await prisma.rule.count()).toBe(0);
  expect(
    await prisma.transaction.count({ where: { categoryId: groceries.id } }),
  ).toBe(0);
  expect(await prisma.transaction.count({ where: { version: 1 } })).toBe(620);
  expect((await post("/transactions/remember-category", input)).status).toBe(
    200,
  );
  const refreshed = {
    ...input,
    source: { ...input.source, version: 2 },
    records: rows.map(({ id }) => ({ id, version: 2 })),
  };
  expect(
    (await post("/transactions/remember-category", refreshed)).status,
  ).toBe(200);
  expect(await prisma.rule.count()).toBe(1);
});
