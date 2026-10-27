import "./fixtures.js";
import request from "supertest";
import { expect, it } from "vitest";
import { today } from "@finance/shared";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { account, origin, post } from "./fixtures.js";

it("requires authentication and rejects malformed CSV without persisting data", async () => {
  expect(
    (
      await request(app)
        .post("/api/imports/headers")
        .set("Origin", origin)
        .send({ csv: "Date,Description,Amount" })
    ).status,
  ).toBe(401);
  expect(
    (
      await post("/imports/headers", {
        csv: "Date,Amount,Amount\n01/10/2026,Shop,10",
      })
    ).status,
  ).toBe(400);
  expect(await prisma.importBatch.count()).toBe(0);
  expect(await prisma.transaction.count()).toBe(0);
});

it("suggests split bank columns without AI and saves selected rows and mapping only on approval", async () => {
  const accountId = await account();
  const csv = `Transaction Date;Details;Withdrawals;Deposits\n${today()};Shop;19.99;\n${today()};Salary;;50.01\ninvalid;Bad row;1;`;
  const headers = await post("/imports/headers", { csv, accountId });
  expect(headers.status).toBe(200);
  const mapping = headers.body.mapping;
  expect(mapping.dateFormat).toBe("ISO");
  const preview = await post("/imports/preview", { csv, accountId, mapping });
  expect(preview.status).toBe(200);
  expect(preview.body).toMatchObject({ validCount: 2, invalidCount: 1 });
  expect(preview.body.rows[2]).toMatchObject({ include: false });
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.importMapping.count()).toBe(0);
  const rows = preview.body.rows.slice(0, 2);
  rows[1].include = false;
  const committed = await post(`/imports/${preview.body.id}/commit`, { rows });
  expect(committed.body).toMatchObject({ imported: 1, alreadyImported: false });
  expect(await prisma.transaction.findMany()).toMatchObject([
    { accountId, date: today(), amountCents: -1999n, description: "Shop" },
  ]);
  expect(
    (await prisma.importMapping.findUniqueOrThrow({ where: { accountId } }))
      .mapping,
  ).toEqual(mapping);
});

it("imports every headerless row with explicit reversed signs and enforces the preview's dates and cents", async () => {
  const accountId = await account();
  const csv = `${today()},19.99,Shop\n${today()},-2.01,Refund`;
  const input = { csv, hasHeaders: false, accountId };
  const headers = await post("/imports/headers", input);
  expect(headers.body.rowCount).toBe(2);
  const preview = await post("/imports/preview", {
    ...input,
    mapping: { ...headers.body.mapping, invertAmounts: true },
  });
  expect(preview.status).toBe(200);
  const rows = preview.body.rows;
  expect(rows.map((row: { amountCents: number }) => row.amountCents)).toEqual([
    -1999, 201,
  ]);
  expect(
    (
      await post(`/imports/${preview.body.id}/commit`, {
        rows: [rows[0], { ...rows[1], date: "2026-01-01" }],
      })
    ).status,
  ).toBe(400);
  expect(await prisma.transaction.count()).toBe(0);
  rows[1].kind = "refund";
  expect(
    (await post(`/imports/${preview.body.id}/commit`, { rows })).body.imported,
  ).toBe(2);
  expect(
    await prisma.transaction.findMany({ orderBy: { sourceRow: "asc" } }),
  ).toMatchObject([
    { kind: "expense", amountCents: -1999n },
    { kind: "refund", amountCents: 201n },
  ]);
  const repeat = await post("/imports/preview", {
    ...input,
    mapping: headers.body.mapping,
  });
  expect(
    (
      await post(`/imports/${repeat.body.id}/commit`, {
        rows: repeat.body.rows,
      })
    ).body.alreadyImported,
  ).toBe(true);
  expect(await prisma.transaction.count()).toBe(2);
});

it("discards incompatible saved columns and refuses archived target accounts", async () => {
  const accountId = await account();
  await prisma.importMapping.create({
    data: {
      accountId,
      mapping: {
        dateColumn: "Old Date",
        descriptionColumn: "Old Details",
        amountColumn: "Old Amount",
        debitColumn: "",
        creditColumn: "",
        dateFormat: "DMY",
      },
    },
  });
  const input = { csv: `Date,Payee,Amount\n${today()},Shop,-1`, accountId };
  const result = await post("/imports/headers", input);
  expect(result.body.mapping).toMatchObject({
    dateColumn: "Date",
    descriptionColumn: "Payee",
    amountColumn: "Amount",
    dateFormat: "ISO",
  });
  await prisma.account.update({
    where: { id: accountId },
    data: { archived: true },
  });
  expect((await post("/imports/headers", input)).status).toBe(409);
  expect(
    (await post("/imports/preview", { ...input, mapping: result.body.mapping }))
      .status,
  ).toBe(409);
});

it("automatically categorises CSV previews like statements and preserves reviewed changes on approval", async () => {
  const accountId = await account();
  const groceries = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const subscriptions = await prisma.category.findFirstOrThrow({
    where: { name: "Subscriptions" },
  });
  await post("/rules", { pattern: "Custom rule", categoryId: dining.id });
  await post("/transactions", {
    accountId,
    kind: "expense",
    date: today(),
    amountCents: 100,
    description: "Known merchant",
    categoryId: groceries.id,
  });
  const csv = `${today()},COLES BRISBANE,-19.99\n${today()},Known merchant,-20.01\n${today()},Custom rule shop,-30\n${today()},NETFLIX,-10`;
  const headers = await post("/imports/headers", { csv, accountId });
  expect(headers.body.hasHeaders).toBe(false);
  expect(headers.body.rowCount).toBe(4);
  const preview = await post("/imports/preview", {
    csv,
    accountId,
    hasHeaders: headers.body.hasHeaders,
    mapping: headers.body.mapping,
  });
  expect(preview.status).toBe(200);
  expect(
    preview.body.rows.map((r: { categoryId: string }) => r.categoryId),
  ).toEqual([groceries.id, groceries.id, dining.id, subscriptions.id]);
  expect(await prisma.transaction.count()).toBe(1);
  preview.body.rows[0].categoryId = dining.id;
  preview.body.rows[2].categoryId = null;
  expect(
    (
      await post(`/imports/${preview.body.id}/commit`, {
        rows: preview.body.rows,
      })
    ).body.imported,
  ).toBe(4);
  const saved = await prisma.transaction.findMany({
    where: { importBatchId: preview.body.id },
    orderBy: { sourceRow: "asc" },
  });
  expect(saved.map((row) => row.categoryId)).toEqual([
    dining.id,
    groceries.id,
    null,
    subscriptions.id,
  ]);
});

it("reconciles and imports every row of a synthetic 620-row bank export", async () => {
  const accountId = await account();
  await prisma.account.update({
    where: { id: accountId },
    data: { openingBalanceCents: 100000n },
  });
  const lines = Array.from(
    { length: 620 },
    (_, index) =>
      `${today()},-1.01,Synthetic purchase ${index},${((100000 - (index + 1) * 101) / 100).toFixed(2)}`,
  );
  const csv = lines.reverse().join("\n");
  const headers = await post("/imports/headers", { csv, accountId });
  expect(headers.body.rowCount).toBe(620);
  const preview = await post("/imports/preview", {
    csv,
    accountId,
    hasHeaders: false,
    mapping: headers.body.mapping,
  });
  expect(preview.body.reconciliation).toMatchObject({
    balanceVerified: true,
    sourceRows: 620,
    bankOpeningCents: 100000,
    bankClosingCents: 37380,
  });
  expect(preview.body.rows).toHaveLength(620);
  const result = await post(`/imports/${preview.body.id}/commit`, {
    rows: preview.body.rows,
  });
  expect(result.body.imported).toBe(620);
  const saved = await prisma.transaction.findMany({ where: { accountId } });
  expect(saved).toHaveLength(620);
  expect(
    saved.reduce((sum, row) => sum + Number(row.amountCents), 100000),
  ).toBe(37380);
  expect(new Set(saved.map((row) => row.sourceRow)).size).toBe(620);
});
