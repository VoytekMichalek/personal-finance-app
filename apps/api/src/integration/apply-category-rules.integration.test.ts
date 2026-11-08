import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { today } from "@finance/shared";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { account, origin, post, put } from "./fixtures.js";

async function setup() {
  const [accountId, otherId] = [await account(), await account()];
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const groceries = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const rule = await post("/rules", {
    pattern: "Local shop",
    matchMode: "exact",
    categoryId: dining.id,
  });
  expect(rule.status).toBe(200);
  await post("/rules", {
    pattern: "shop",
    categoryId: groceries.id,
    priority: -1,
  });
  const rows = await Promise.all(
    Array.from({ length: 23 }, (_, i) =>
      prisma.transaction.create({
        data: {
          accountId: i % 2 ? accountId : otherId,
          date: today(),
          description: "LOCAL   SHOP",
          kind: i === 22 ? "refund" : "expense",
          amountCents: i === 22 ? 100n : -100n,
          owner: "household",
        },
      }),
    ),
  );
  return {
    rows,
    dining,
    groceries,
    rule: rule.body,
    accountId,
    otherId,
    records: rows.map((r) => ({
      id: r.id,
      version: r.version,
      categoryId: dining.id,
    })),
  };
}

it("applies reviewed category matches across accounts and pages without expanding the selection or changing ledger facts", async () => {
  const { records, rows, groceries, accountId, dining } = await setup();
  const chosen = await prisma.transaction.create({
    data: {
      accountId,
      date: today(),
      description: "Local shop",
      kind: "expense",
      amountCents: -300n,
      categoryId: groceries.id,
      owner: "household",
    },
  });
  const response = await post("/rules/apply-categories", {
    records: records.slice(0, 22),
  });
  expect(response.status, response.body.error).toBe(200);
  expect(response.body.updated).toBe(22);
  for (const before of rows.slice(0, 22)) {
    const after = await prisma.transaction.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after).toEqual({
      ...before,
      updatedAt: after.updatedAt,
      categoryId: dining.id,
      version: before.version + 1,
    });
  }
  expect(
    await prisma.transaction.findUnique({ where: { id: chosen.id } }),
  ).toEqual(chosen);
  expect(
    await prisma.transaction.findUnique({ where: { id: rows[22]!.id } }),
  ).toEqual(rows[22]);
  expect(
    (await post("/rules/apply-categories", { records: [records[22]] })).status,
  ).toBe(200);
  expect((await post("/rules/apply-categories", { records })).status).toBe(409);
});

it.each(["transaction", "rule", "category", "account"])(
  "rejects a stale %s atomically with a recovery path",
  async (changed) => {
    const { records, rows, groceries, rule, dining, otherId } = await setup();
    if (changed === "transaction")
      await prisma.transaction.update({
        where: { id: rows[22]!.id },
        data: { categoryId: groceries.id, version: { increment: 1 } },
      });
    if (changed === "rule")
      expect(
        (await put("/rules/" + rule.id, { ...rule, enabled: false })).status,
      ).toBe(200);
    if (changed === "category")
      await prisma.category.update({
        where: { id: dining.id },
        data: { archived: true },
      });
    if (changed === "account")
      await prisma.account.update({
        where: { id: otherId },
        data: { archived: true },
      });
    const before = await prisma.transaction.findMany({
      orderBy: { id: "asc" },
    });
    const response = await post("/rules/apply-categories", { records });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Refresh data");
    expect(
      await prisma.transaction.findMany({ orderBy: { id: "asc" } }),
    ).toEqual(before);
  },
);

it("rejects forged categories, transfers, duplicate IDs and unauthenticated changes", async () => {
  const { records, rows, groceries } = await setup();
  expect(
    (
      await post("/rules/apply-categories", {
        records: [{ ...records[0], categoryId: groceries.id }],
      })
    ).status,
  ).toBe(409);
  await prisma.transaction.update({
    where: { id: rows[0]!.id },
    data: { kind: "transfer" },
  });
  expect((await post("/rules/apply-categories", { records })).status).toBe(409);
  expect(
    (
      await post("/rules/apply-categories", {
        records: [records[1], records[1]],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post("/api/rules/apply-categories")
        .set("Origin", origin)
        .send({ records })
    ).status,
  ).toBe(401);
  expect(
    await prisma.transaction.count({ where: { categoryId: { not: null } } }),
  ).toBe(0);
});
