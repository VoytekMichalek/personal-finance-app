import "./fixtures.js";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { today } from "@finance/shared";
import { prisma } from "../lib/db.js";
import { account, post } from "./fixtures.js";

async function seed(count = 620) {
  const accountId = await account();
  await prisma.transaction.createMany({
    data: Array.from({ length: count }, (_, index) => ({
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

it("deletes all selected pages atomically and preserves unselected records", async () => {
  const records = await seed();
  const response = await post("/transactions/bulk-delete", {
    records: records.slice(0, 619),
  });
  expect(response.status).toBe(200);
  expect(response.body.deletedCount).toBe(619);
  expect(
    await prisma.transaction.findMany({ select: { id: true, version: true } }),
  ).toEqual([records[619]]);
  expect(await prisma.account.count()).toBe(1);
});

it("rolls back earlier deleted chunks when a later row is stale", async () => {
  const records = await seed();
  await prisma.transaction.update({
    where: { id: records[619]!.id },
    data: { version: 2 },
  });
  expect((await post("/transactions/bulk-delete", { records })).status).toBe(
    409,
  );
  expect(await prisma.transaction.count()).toBe(620);
});

it("requires authenticated, unique, bounded selections and rejects missing rows", async () => {
  const records = await seed(2);
  expect(
    (await post("/transactions/bulk-delete", { records }, "")).status,
  ).toBe(401);
  for (const invalid of [
    [],
    [records[0], records[0]],
    [{ id: records[0]!.id, version: 0 }],
    Array(10001).fill(records[0]),
  ])
    expect(
      (await post("/transactions/bulk-delete", { records: invalid })).status,
    ).toBe(400);
  expect(
    (
      await post("/transactions/bulk-delete", {
        records: [...records, { id: randomUUID(), version: 1 }],
      })
    ).status,
  ).toBe(409);
  expect(await prisma.transaction.count()).toBe(2);
});

it("requires confirmed counterparts and versions, and protects receipts on either transfer side", async () => {
  const fromAccountId = await account();
  const toAccountId = await account();
  expect(
    (
      await post("/transfers", {
        fromAccountId,
        toAccountId,
        date: today(),
        amountCents: 1000,
      })
    ).status,
  ).toBe(201);
  const records = await prisma.transaction.findMany({
    orderBy: { id: "asc" },
    select: { id: true, version: true },
  });
  expect(
    (await post("/transactions/bulk-delete", { records: [records[0]] })).status,
  ).toBe(409);
  const receipt = await prisma.receipt.create({
    data: {
      transactionId: records[1]!.id,
      objectKey: "synthetic-receipt",
      filename: "receipt.png",
      mimeType: "image/png",
      size: 1,
    },
  });
  const blocked = await post("/transactions/bulk-delete", { records });
  expect(blocked.status).toBe(409);
  expect(blocked.body.error).toMatch(/receipts/);
  expect(await prisma.receipt.count()).toBe(1);
  expect(await prisma.transaction.count()).toBe(2);
  await prisma.receipt.delete({ where: { id: receipt.id } });
  await prisma.transaction.update({
    where: { id: records[1]!.id },
    data: { version: 2 },
  });
  expect((await post("/transactions/bulk-delete", { records })).status).toBe(
    409,
  );
  expect(await prisma.transaction.count()).toBe(2);
  records[1]!.version = 2;
  expect(
    (await post("/transactions/bulk-delete", { records })).body.deletedCount,
  ).toBe(2);
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.account.count()).toBe(2);
});
