import request from "supertest";
import { expect, it } from "vitest";
import { today } from "@finance/shared";
import { account, memberId, post, put, origin } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";

async function payment(
  accountId: string,
  kind = "expense",
  description = "Recorded payment",
) {
  const category = await prisma.category.findFirstOrThrow({
    where: { name: kind === "income" ? "Salary" : "Dining" },
  });
  const result = await post("/transactions", {
    accountId,
    kind,
    description,
    date: today(),
    amountCents: 12500,
    categoryId: category.id,
    owner: memberId,
    notes: "Keep my note",
  });
  expect(result.status).toBe(201);
  return result.body;
}
const change = (id: string, data: Record<string, unknown>) =>
  put(`/transactions/${id}/type`, data);

it("creates a balanced transfer without replacing the original row or its receipt and source", async () => {
  const accountId = await account();
  const counterAccountId = await account();
  const row = await payment(accountId);
  const batch = await prisma.importBatch.create({
    data: {
      accountId,
      fileHash: "type-source",
      mapping: {},
      preview: {},
      expiresAt: new Date(),
      committedAt: new Date(),
    },
  });
  await prisma.transaction.update({
    where: { id: row.id },
    data: { importBatchId: batch.id, sourceRow: 3 },
  });
  const receipt = await prisma.receipt.create({
    data: {
      transactionId: row.id,
      objectKey: "type-receipt",
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      size: 10,
    },
  });
  expect(
    (
      await change(row.id, {
        version: 1,
        kind: "transfer",
        counterAccountId,
        createCounterpart: true,
      })
    ).status,
  ).toBe(200);
  const stored = await prisma.transaction.findUniqueOrThrow({
    where: { id: row.id },
    include: { receipts: true },
  });
  expect(stored).toMatchObject({
    kind: "transfer",
    amountCents: -12500n,
    date: today(),
    notes: "Keep my note",
    owner: memberId,
    categoryId: null,
    importBatchId: batch.id,
    sourceRow: 3,
    version: 2,
  });
  expect(stored.receipts[0]?.id).toBe(receipt.id);
  const peer = await prisma.transaction.findFirstOrThrow({
    where: { transferGroupId: stored.transferGroupId, id: { not: row.id } },
  });
  expect(peer).toMatchObject({
    accountId: counterAccountId,
    amountCents: 12500n,
    kind: "transfer",
    date: today(),
  });
  expect(await prisma.transaction.count()).toBe(2);
  expect(
    (
      await change(row.id, {
        version: 2,
        kind: "expense",
        unlinkCounterpart: {
          id: peer.id,
          version: peer.version,
          kind: "income",
        },
      })
    ).status,
  ).toBe(200);
  expect(await prisma.transaction.count()).toBe(2);
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({
    kind: "expense",
    transferGroupId: null,
    version: 3,
    importBatchId: batch.id,
  });
  expect(
    await prisma.transaction.findUnique({ where: { id: peer.id } }),
  ).toMatchObject({
    kind: "income",
    transferGroupId: null,
    amountCents: 12500n,
    version: 2,
  });
  expect(await prisma.receipt.count()).toBe(1);
});

it("links an existing opposite payment, rejects stale peers atomically and never duplicates it", async () => {
  const accountId = await account();
  const counterAccountId = await account();
  const row = await payment(accountId);
  const peer = await payment(
    counterAccountId,
    "income",
    "Other bank reference",
  );
  const input = {
    version: 1,
    kind: "transfer",
    counterAccountId,
    linkExisting: { id: peer.id, version: 1 },
  };
  await prisma.transaction.update({
    where: { id: peer.id },
    data: { version: { increment: 1 } },
  });
  expect((await change(row.id, input)).status).toBe(409);
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({ kind: "expense", version: 1 });
  const results = await Promise.all([
    change(row.id, { ...input, linkExisting: { id: peer.id, version: 2 } }),
    change(peer.id, {
      version: 2,
      kind: "transfer",
      counterAccountId: accountId,
      linkExisting: { id: row.id, version: 1 },
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const pair = await prisma.transaction.findMany();
  expect(pair).toHaveLength(2);
  expect(pair.every((r) => r.kind === "transfer")).toBe(true);
  expect(pair[0]?.transferGroupId).toBeTruthy();
  expect(pair[0]?.transferGroupId).toBe(pair[1]?.transferGroupId);
  expect(pair.map((r) => r.description).sort()).toEqual([
    "Other bank reference",
    "Recorded payment",
  ]);
});

it("enforces authentication, version, account and explicit counterpart choices", async () => {
  const accountId = await account();
  const otherId = await account();
  const row = await payment(accountId);
  expect(
    (
      await request(app)
        .put(`/api/transactions/${row.id}/type`)
        .set("Origin", origin)
        .send({ version: 1, kind: "income" })
    ).status,
  ).toBe(401);
  for (const body of [
    {
      version: 1,
      kind: "transfer",
      counterAccountId: accountId,
      createCounterpart: true,
    },
    { version: 1, kind: "transfer", counterAccountId: otherId },
    { version: 1, kind: "invalid" },
  ])
    expect((await change(row.id, body)).status).toBe(400);
  await prisma.account.update({
    where: { id: otherId },
    data: { openingDate: "2099-01-01" },
  });
  expect(
    (
      await change(row.id, {
        version: 1,
        kind: "transfer",
        counterAccountId: otherId,
        createCounterpart: true,
      })
    ).status,
  ).toBe(400);
  expect((await change(row.id, { version: 9, kind: "income" })).status).toBe(
    409,
  );
  expect(await prisma.transaction.count()).toBe(1);
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({ version: 1, kind: "expense" });
});

it("changes regular types with compatible categories and signed cents, and protects scheduled payments", async () => {
  const row = await payment(await account());
  expect((await change(row.id, { version: 1, kind: "refund" })).status).toBe(
    200,
  );
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({
    kind: "refund",
    amountCents: 12500n,
    categoryId: row.categoryId,
    version: 2,
  });
  expect((await change(row.id, { version: 2, kind: "income" })).status).toBe(
    200,
  );
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({
    kind: "income",
    amountCents: 12500n,
    categoryId: null,
    version: 3,
  });
  await prisma.transaction.update({
    where: { id: row.id },
    data: { occurrenceDate: today() },
  });
  expect((await change(row.id, { version: 3, kind: "expense" })).status).toBe(
    409,
  );
  expect(
    await prisma.transaction.findUnique({ where: { id: row.id } }),
  ).toMatchObject({ kind: "income", amountCents: 12500n, version: 3 });
});
