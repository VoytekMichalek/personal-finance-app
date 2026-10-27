import "./fixtures.js";
import { expect, it, vi } from "vitest";
import request from "supertest";
import { today } from "@finance/shared";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { account, post, memberCookie, origin } from "./fixtures.js";
import * as deletion from "../modules/finance/bulk-delete.js";

const remove = (id: string) =>
  request(app)
    .delete("/api/transactions/" + id)
    .set("Cookie", memberCookie)
    .set("Origin", origin);

it("preserves both linked entries when an import links a payment during single deletion", async () => {
  const source = await account();
  const other = await account();
  const payment = await prisma.transaction.create({
    data: {
      accountId: other,
      date: today(),
      amountCents: 200n,
      kind: "income",
      description: "Existing payment",
      owner: "household",
    },
  });
  const preview = await post("/imports/preview", {
    accountId: source,
    csv: `Date,Description,Amount\n${today()},Transfer,-2.00`,
    mapping: {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      dateFormat: "ISO",
    },
  });
  expect(preview.status).toBe(200);
  let entered!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = deletion.bulkDelete;
  const spy = vi
    .spyOn(deletion, "bulkDelete")
    .mockImplementationOnce(async (body) => {
      entered();
      await gate;
      return original(body);
    });
  try {
    const pending = remove(payment.id).then((response) => response);
    await Promise.race([
      reached,
      pending.then(() => {
        throw new Error("Delete did not reach the guarded operation");
      }),
    ]);
    // Real import commits after deletion captured the old unlinked version.
    const imported = await post(`/imports/${preview.body.id}/commit`, {
      rows: [
        {
          ...preview.body.rows[0],
          kind: "transfer",
          counterAccountId: other,
          linkExisting: { id: payment.id, version: payment.version },
        },
      ],
    });
    expect(imported.status, imported.body.error).toBe(200);
    release();
    const result = await pending;
    expect(result.status).toBe(409);
    const rows = await prisma.transaction.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === "transfer")).toBe(true);
    expect(new Set(rows.map((row) => row.transferGroupId)).size).toBe(1);
    expect(rows.reduce((sum, row) => sum + row.amountCents, 0n)).toBe(0n);
  } finally {
    release();
    spy.mockRestore();
  }
});

it("deletes a complete transfer only after receipts are removed and rejects missing records", async () => {
  const fromAccountId = await account();
  const toAccountId = await account();
  expect(
    (
      await post("/transfers", {
        fromAccountId,
        toAccountId,
        date: today(),
        amountCents: 500,
      })
    ).status,
  ).toBe(201);
  const rows = await prisma.transaction.findMany();
  const receipt = await prisma.receipt.create({
    data: {
      transactionId: rows[1]!.id,
      objectKey: "synthetic/single-delete",
      filename: "receipt.png",
      mimeType: "image/png",
      size: 1,
    },
  });
  expect(
    (
      await request(app)
        .delete("/api/transactions/" + rows[0]!.id)
        .set("Origin", origin)
    ).status,
  ).toBe(401);
  expect((await remove(rows[0]!.id)).status).toBe(409);
  expect(await prisma.transaction.count()).toBe(2);
  await prisma.receipt.delete({ where: { id: receipt.id } });
  expect((await remove(rows[0]!.id)).status).toBe(200);
  expect(await prisma.transaction.count()).toBe(0);
  expect((await remove(rows[0]!.id)).status).toBe(404);
});
