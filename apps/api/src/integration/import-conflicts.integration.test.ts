import "./fixtures.js";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  addDays,
  today,
  type ImportRow,
  type ImportConflictDetails,
} from "@finance/shared";
import { prisma } from "../lib/db.js";
import { account, memberId, post } from "./fixtures.js";
import * as linking from "../modules/imports/link-payment.js";

async function preview(accountId: string, values: number[]) {
  const result = await post("/imports/preview", {
    accountId,
    csv:
      "Date,Description,Amount\n" +
      values
        .map((value, i) => `${today()},Import row ${i + 1},${value}`)
        .join("\n"),
    mapping: {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      dateFormat: "ISO",
    },
  });
  expect(result.status).toBe(200);
  return result.body as { id: string; rows: ImportRow[] };
}

async function payment(accountId: string, amountCents = 200n) {
  return prisma.transaction.create({
    data: {
      accountId,
      amountCents,
      date: today(),
      kind: amountCents < 0 ? "expense" : "income",
      description: "Previously recorded payment",
      owner: memberId,
      notes: "Keep these notes",
    },
  });
}

function transfer(
  row: ImportRow,
  counterAccountId: string,
  target?: { id: string; version: number },
) {
  return {
    ...row,
    kind: "transfer" as const,
    include: true,
    counterAccountId,
    ...(target
      ? { linkExisting: { id: target.id, version: target.version } }
      : {}),
  };
}

it("returns every row conflict with identifiable matches before writing and honours explicit separate payments", async () => {
  const source = await account();
  const other = await account();
  const duplicate = await payment(source, -100n);
  const matchA = await payment(other);
  const matchB = await payment(other);
  const batch = await preview(source, [-1, -2, -3]);
  const rows = batch.rows.map((row) => ({ ...row, include: true }));
  rows[1] = transfer(rows[1]!, other);
  const rejected = await post(`/imports/${batch.id}/commit`, { rows });
  expect(rejected.status).toBe(409);
  const details = rejected.body.details as ImportConflictDetails;
  expect(details.type).toBe("import-conflicts");
  expect(details.conflicts).toHaveLength(2);
  expect(details.conflicts[0]).toMatchObject({
    rowNumber: rows[0]!.rowNumber,
    reason: "duplicate",
    matches: [
      {
        id: duplicate.id,
        amountCents: -100,
        accountId: source,
        date: today(),
        description: duplicate.description,
        version: 1,
        kind: "expense",
        transferGroupId: null,
      },
    ],
  });
  expect(details.conflicts[1]).toMatchObject({
    rowNumber: rows[1]!.rowNumber,
    reason: "counterpart",
  });
  expect(details.conflicts[1]!.matches.map((row) => row.id).sort()).toEqual(
    [matchA.id, matchB.id].sort(),
  );
  expect(await prisma.transaction.count()).toBe(3);
  expect(
    (await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } }))
      .committedAt,
  ).toBeNull();
  const retained = await post(`/imports/${batch.id}/commit`, {
    rows: rows.map((row) => ({ ...row, allowDuplicate: true })),
  });
  expect(retained.body.imported).toBe(3);
  expect(await prisma.transaction.count()).toBe(7);
});

it("links the existing opposite payment while retaining its receipt, attribution and financial fields", async () => {
  const source = await account();
  const other = await account();
  const originalBatch = await prisma.importBatch.create({
    data: {
      accountId: other,
      fileHash: randomUUID(),
      mapping: {},
      preview: [],
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const salary = await prisma.category.findFirstOrThrow({
    where: { name: "Salary" },
  });
  const original = await payment(other);
  const existing = await prisma.transaction.update({
    where: { id: original.id },
    data: {
      importBatchId: originalBatch.id,
      sourceRow: 7,
      categoryId: salary.id,
    },
  });
  const receipt = await prisma.receipt.create({
    data: {
      transactionId: existing.id,
      objectKey: "synthetic/receipt",
      filename: "receipt.png",
      mimeType: "image/png",
      size: 42,
    },
  });
  const batch = await preview(source, [-2]);
  const rows = [transfer(batch.rows[0]!, other, existing)];
  const result = await post(`/imports/${batch.id}/commit`, { rows });
  expect(result.status).toBe(200);
  expect(result.body.imported).toBe(1);
  const after = await prisma.transaction.findUniqueOrThrow({
    where: { id: existing.id },
  });
  expect(after).toMatchObject({
    ...existing,
    kind: "transfer",
    categoryId: null,
    transferGroupId: expect.any(String),
    version: 2,
    updatedAt: expect.any(Date),
  });
  expect(
    await prisma.receipt.findUnique({ where: { id: receipt.id } }),
  ).toEqual(receipt);
  const imported = await prisma.transaction.findFirstOrThrow({
    where: { importBatchId: batch.id },
  });
  expect(imported).toMatchObject({
    kind: "transfer",
    amountCents: -200n,
    sourceRow: rows[0]!.rowNumber,
    transferGroupId: after.transferGroupId,
    owner: rows[0]!.owner,
  });
  expect(await prisma.transaction.count()).toBe(2);
  expect(
    (await post(`/imports/${batch.id}/commit`, { rows })).body.alreadyImported,
  ).toBe(true);
  expect(await prisma.transaction.count()).toBe(2);
});

it("does not allow linking to bypass a source duplicate and rejects reusing the same payment", async () => {
  const source = await account();
  const other = await account();
  const target = await payment(other);
  await payment(source, -200n);
  const batch = await preview(source, [-2, -2]);
  const rows = batch.rows.map((row) => transfer(row, other, target));
  const reused = await post(`/imports/${batch.id}/commit`, { rows });
  expect(reused.status).toBe(409);
  expect(
    (reused.body.details as ImportConflictDetails).conflicts.map(
      (conflict) => conflict.reason,
    ),
  ).toEqual(["duplicate", "stale-link", "duplicate", "stale-link"]);
  rows[1]!.include = false;
  const duplicate = await post(`/imports/${batch.id}/commit`, { rows });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.details.conflicts).toHaveLength(1);
  expect(duplicate.body.details.conflicts[0].reason).toBe("duplicate");
  expect(await prisma.transaction.count()).toBe(2);
  rows[0]!.allowDuplicate = true;
  expect((await post(`/imports/${batch.id}/commit`, { rows })).status).toBe(
    200,
  );
  expect(await prisma.transaction.count()).toBe(3);
});

it("returns stale-link details for changed, linked, scheduled and missing payments", async () => {
  const source = await account();
  const other = await account();
  const wrongAccount = await account();
  const target = await payment(other);
  const schedule = await prisma.schedule.create({
    data: {
      accountId: other,
      kind: "income",
      amountCents: 200n,
      name: "Scheduled income",
      startDate: today(),
      frequency: "monthly",
    },
  });
  const batch = await preview(source, [-2]);
  const rows = [transfer(batch.rows[0]!, other, target)];
  for (const change of [
    { version: 2 },
    { accountId: wrongAccount },
    { amountCents: 201n },
    { date: addDays(today(), -1) },
    { kind: "transfer", transferGroupId: randomUUID() },
    { scheduleId: schedule.id, occurrenceDate: today() },
    { occurrenceDate: today() },
  ]) {
    await prisma.transaction.update({
      where: { id: target.id },
      data: {
        version: 1,
        accountId: other,
        amountCents: 200n,
        date: today(),
        kind: "income",
        transferGroupId: null,
        scheduleId: null,
        occurrenceDate: null,
        ...change,
      },
    });
    const result = await post(`/imports/${batch.id}/commit`, { rows });
    expect(result.status).toBe(409);
    expect(result.body.details.conflicts).toMatchObject([
      {
        rowNumber: rows[0]!.rowNumber,
        reason: "stale-link",
        matches: [{ id: target.id }],
      },
    ]);
    expect(await prisma.transaction.count()).toBe(1);
  }
  await prisma.transaction.delete({ where: { id: target.id } });
  const missing = await post(`/imports/${batch.id}/commit`, { rows });
  expect(missing.status).toBe(409);
  expect(missing.body.details.conflicts[0]).toMatchObject({
    reason: "stale-link",
    matches: [],
  });
});

it("enforces account history, archive and owner checks before linking", async () => {
  const source = await account();
  const other = await account();
  const target = await payment(other);
  const batch = await preview(source, [-2]);
  const rows = [transfer(batch.rows[0]!, other, target)];
  for (const id of [source, other]) {
    await prisma.account.update({ where: { id }, data: { archived: true } });
    expect((await post(`/imports/${batch.id}/commit`, { rows })).status).toBe(
      409,
    );
    await prisma.account.update({ where: { id }, data: { archived: false } });
  }
  await prisma.account.update({
    where: { id: other },
    data: { openingDate: addDays(today(), 1) },
  });
  expect((await post(`/imports/${batch.id}/commit`, { rows })).status).toBe(
    400,
  );
  await prisma.account.update({
    where: { id: other },
    data: { openingDate: today() },
  });
  expect(
    (
      await post(`/imports/${batch.id}/commit`, {
        rows: [{ ...rows[0], owner: randomUUID() }],
      })
    ).status,
  ).toBe(400);
  expect(await prisma.transaction.count()).toBe(1);
  expect(
    (await prisma.transaction.findUniqueOrThrow({ where: { id: target.id } }))
      .kind,
  ).toBe("income");
});

it("rolls back earlier imported rows when a payment changes after conflict review", async () => {
  const source = await account();
  const other = await account();
  const target = await payment(other);
  const batch = await preview(source, [-1, -2]);
  const rows = [batch.rows[0]!, transfer(batch.rows[1]!, other, target)];
  let entered!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = linking.linkImportedPayment;
  const spy = vi
    .spyOn(linking, "linkImportedPayment")
    .mockImplementationOnce(async (...args) => {
      entered();
      await gate;
      return original(...args);
    });
  try {
    const pending = post(`/imports/${batch.id}/commit`, { rows }).then(
      (result) => result,
    );
    await Promise.race([
      reached,
      pending.then(() => {
        throw new Error("Import did not reach the link operation");
      }),
    ]);
    // The actual database edit races after the initial conflict check and first insert.
    await prisma.transaction.update({
      where: { id: target.id },
      data: {
        description: "Changed by another member",
        version: { increment: 1 },
      },
    });
    release();
    const result = await pending;
    expect(result.status).toBe(409);
    expect(result.body.details.conflicts[0]).toMatchObject({
      reason: "stale-link",
      matches: [
        { id: target.id, version: 2, description: "Changed by another member" },
      ],
    });
    expect(await prisma.transaction.count()).toBe(1);
    expect(
      (await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .committedAt,
    ).toBeNull();
  } finally {
    release();
    spy.mockRestore();
  }
});
