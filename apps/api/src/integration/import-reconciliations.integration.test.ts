import "./fixtures.js";
import { expect, it } from "vitest";
import {
  importReconciliations,
  today,
  type ImportRow,
  type Transaction,
} from "@finance/shared";
import { prisma, json } from "../lib/db.js";
import { account, memberId, post } from "./fixtures.js";

async function setup(values = [25, 30]) {
  const from = await account(),
    to = await account();
  for (const value of values)
    expect(
      (
        await post("/transfers", {
          fromAccountId: from,
          toAccountId: to,
          date: today(),
          amountCents: value * 100,
          description: "Original transfer",
        })
      ).status,
    ).toBe(201);
  const firstBatch = await prisma.importBatch.create({
    data: {
      accountId: from,
      fileHash: "original-import",
      mapping: {},
      preview: [],
      committedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const originalSides = await prisma.transaction.findMany({
    where: { accountId: from },
    orderBy: { amountCents: "desc" },
  });
  for (const [index, row] of originalSides.entries())
    await prisma.transaction.update({
      where: { id: row.id },
      data: {
        importBatchId: firstBatch.id,
        sourceRow: index + 1,
        notes: "Original source notes",
      },
    });
  await prisma.transaction.updateMany({
    where: { accountId: to },
    data: { owner: memberId, notes: "Preserve receiving-side notes" },
  });
  const receiptEntry = await prisma.transaction.findFirstOrThrow({
    where: { accountId: to },
  });
  await prisma.receipt.create({
    data: {
      transactionId: receiptEntry.id,
      objectKey: "synthetic/reconciled-receipt",
      filename: "transfer.png",
      mimeType: "image/png",
      size: 12,
    },
  });
  const result = await post("/imports/preview", {
    accountId: to,
    csv:
      "Date,Description,Amount\n" +
      values
        .map((value, i) => `${today()},Different bank narrative ${i},${value}`)
        .join("\n"),
    mapping: {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      dateFormat: "ISO",
    },
  });
  expect(result.status).toBe(200);
  const original = await prisma.transaction.findMany({
    orderBy: { id: "asc" },
  });
  const candidates = importReconciliations(
    to,
    result.body.rows,
    json<Transaction[]>(original),
  );
  const rows: ImportRow[] = result.body.rows.map((row: ImportRow) => ({
    ...row,
    include: true,
    kind: "transfer",
    counterAccountId: from,
    reconcileExisting: candidates.find(
      (item) => item.rowNumber === row.rowNumber,
    )?.choice,
  }));
  return { from, to, id: result.body.id as string, original, rows };
}
it("accepts all clear matches without changing balances, ownership, notes or counterpart provenance and is idempotent", async () => {
  const { id, rows, original, to } = await setup();
  expect(rows.every((row) => row.reconcileExisting)).toBe(true);
  const results = await Promise.all([
    post(`/imports/${id}/commit`, { rows }),
    post(`/imports/${id}/commit`, { rows }),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results.map((r) => r.body.imported)).toEqual([2, 2]);
  expect(results.filter((r) => r.body.alreadyImported)).toHaveLength(1);
  const stored = await prisma.transaction.findMany({ orderBy: { id: "asc" } });
  expect(stored).toHaveLength(4);
  expect(await prisma.receipt.count()).toBe(1);
  for (const before of original) {
    const after = stored.find((row) => row.id === before.id)!;
    expect(after).toEqual({
      ...before,
      updatedAt: before.accountId === to ? after.updatedAt : before.updatedAt,
      ...(before.accountId === to
        ? {
            importBatchId: id,
            sourceRow: rows.find(
              (row) => row.reconcileExisting?.id === before.id,
            )!.rowNumber,
            version: before.version + 1,
          }
        : {}),
    });
  }
});
it("rejects stale counterpart versions atomically and recovers after renewed acceptance", async () => {
  const { id, rows, original } = await setup();
  const changed = rows[1]!.reconcileExisting!;
  await prisma.transaction.update({
    where: { id: changed.counterpartId },
    data: { notes: "Competing edit", version: { increment: 1 } },
  });
  const failed = await post(`/imports/${id}/commit`, { rows });
  expect(failed.status).toBe(409);
  expect(failed.body.details.conflicts[0].reason).toBe("stale-reconciliation");
  expect(await prisma.transaction.count({ where: { importBatchId: id } })).toBe(
    0,
  );
  expect(await prisma.transaction.count()).toBe(original.length);
  changed.counterpartVersion++;
  expect((await post(`/imports/${id}/commit`, { rows })).status).toBe(200);
});
it("rejects reused references, wrong accounts, source tampering and newly ambiguous matches", async () => {
  const { id, rows, to } = await setup();
  const reused = structuredClone(rows);
  reused[1]!.reconcileExisting = reused[0]!.reconcileExisting;
  expect((await post(`/imports/${id}/commit`, { rows: reused })).status).toBe(
    409,
  );
  const tampered = structuredClone(rows);
  tampered[0]!.amountCents++;
  expect((await post(`/imports/${id}/commit`, { rows: tampered })).status).toBe(
    400,
  );
  const wrong = structuredClone(rows);
  wrong[0]!.counterAccountId = await account();
  expect((await post(`/imports/${id}/commit`, { rows: wrong })).status).toBe(
    409,
  );
  await post("/transactions", {
    accountId: to,
    date: today(),
    amountCents: rows[0]!.amountCents,
    kind: "income",
    description: "Another payment with same amount",
  });
  expect((await post(`/imports/${id}/commit`, { rows })).status).toBe(409);
  expect(await prisma.transaction.count({ where: { importBatchId: id } })).toBe(
    0,
  );
});
it("rolls reconciliation back when another import row fails and never consumes an already claimed transfer", async () => {
  const { id, rows, original } = await setup();
  rows[1] = {
    ...rows[1]!,
    reconcileExisting: undefined,
    kind: "income",
    counterAccountId: null,
    allowDuplicate: false,
  };
  expect((await post(`/imports/${id}/commit`, { rows })).status).toBe(409);
  expect(await prisma.transaction.findMany({ orderBy: { id: "asc" } })).toEqual(
    original,
  );
  rows[1]!.include = false;
  expect((await post(`/imports/${id}/commit`, { rows })).status).toBe(200);
  const next = await prisma.importBatch.create({
    data: {
      accountId: original.find(
        (row) => row.id === rows[0]!.reconcileExisting!.id,
      )!.accountId,
      fileHash: "different",
      preview: json(rows),
      mapping: {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
        dateFormat: "ISO",
      },
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  expect((await post(`/imports/${next.id}/commit`, { rows })).status).toBe(409);
});
