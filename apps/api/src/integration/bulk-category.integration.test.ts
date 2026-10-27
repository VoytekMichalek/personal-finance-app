import "./fixtures.js";
import { expect, it } from "vitest";
import { today } from "@finance/shared";
import { prisma } from "../lib/db.js";
import { account, post } from "./fixtures.js";
async function seed() {
  const accountId = await account();
  await prisma.transaction.createMany({
    data: Array.from({ length: 620 }, (_, index) => ({
      accountId,
      date: today(),
      amountCents: -101n,
      kind: "expense",
      description: "Synthetic purchase " + index,
      owner: "household",
    })),
  });
  return prisma.transaction.findMany({
    orderBy: { id: "asc" },
    select: { id: true, version: true },
  });
}
it("categorises more than a page atomically, retaining cents and dates", async () => {
  const records = await seed();
  const category = await prisma.category.findFirstOrThrow({
    where: { kind: "expense" },
  });
  expect(
    (
      await post("/transactions/bulk-category", {
        categoryId: category.id,
        records,
      })
    ).status,
  ).toBe(200);
  expect(
    await prisma.transaction.count({
      where: {
        categoryId: category.id,
        version: 2,
        amountCents: -101n,
        date: today(),
      },
    }),
  ).toBe(620);
});
it("rolls back earlier chunks on a stale row and rejects repeated IDs", async () => {
  const records = await seed();
  await prisma.transaction.update({
    where: { id: records[619]!.id },
    data: { version: 2 },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { kind: "expense" },
  });
  expect(
    (
      await post("/transactions/bulk-category", {
        categoryId: category.id,
        records,
      })
    ).status,
  ).toBe(409);
  expect(
    await prisma.transaction.count({ where: { categoryId: category.id } }),
  ).toBe(0);
  expect(await prisma.transaction.count({ where: { version: 1 } })).toBe(619);
  expect(
    (
      await post("/transactions/bulk-category", {
        categoryId: null,
        records: [records[0], records[0]],
      })
    ).status,
  ).toBe(400);
});
