import request from "supertest";
import { expect, it } from "vitest";
import { today, updateImportRows } from "@finance/shared";
import { account, memberCookie, origin, post } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPdf } from "./statement-fixture.js";

async function preview(accountId: string, format: string) {
  if (format === "PDF") {
    const uploaded = await request(app)
      .post("/api/statements")
      .set("Cookie", memberCookie)
      .set("Origin", origin)
      .field("accountId", accountId)
      .attach(
        "file",
        statementPdf([
          [
            "Bank statement 2026",
            "Opening balance 1000.00",
            `${today()} Local Shop -10.00`,
            `${today()} LOCAL SHOP -20.00`,
            "Closing balance 970.00",
          ],
        ]),
        "remember.pdf",
      );
    expect(uploaded.status).toBe(202);
    await processClaimedStatement((await claimStatement())!);
    const read = await request(app)
      .get("/api/statements/" + uploaded.body.id)
      .set("Cookie", memberCookie);
    expect(read.body.status).toBe("ready");
    return {
      ...read.body,
      path: "/statements/" + read.body.id + "/commit",
      extra: {
        applyOpening: false,
        opening: null,
        reviewed: true,
        schedules: [],
      },
    };
  }
  const csv = `Date,Description,Amount\n${today()},Local Shop,-10.00\n${today()},LOCAL SHOP,-20.00`;
  const headers = await post("/imports/headers", { csv, accountId });
  const result = await post("/imports/preview", {
    csv,
    accountId,
    mapping: headers.body.mapping,
  });
  expect(result.status).toBe(200);
  return {
    ...result.body,
    path: "/imports/" + result.body.id + "/commit",
    extra: {},
  };
}

it.each(["CSV", "PDF"])(
  "%s saves remembered categories atomically and uses one exact rule on future imports",
  async (format) => {
    const accountId = await account();
    const dining = await prisma.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    const groceries = await prisma.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    const result = await preview(accountId, format);
    const rows = updateImportRows(result.rows, 1, {
      categoryId: dining.id,
      rememberCategory: true,
    });
    expect(await prisma.rule.count()).toBe(0);
    const response = await post(result.path, { ...result.extra, rows });
    expect(response.body).toMatchObject({
      imported: 2,
      alreadyImported: false,
    });
    expect(await prisma.rule.findMany()).toMatchObject([
      { pattern: "local shop", matchMode: "exact", categoryId: dining.id },
    ]);
    expect(
      (await prisma.transaction.findMany()).map((row) => row.categoryId),
    ).toEqual([dining.id, dining.id]);
    expect(
      (await post(result.path, { ...result.extra, rows })).body.alreadyImported,
    ).toBe(true);
    expect(await prisma.rule.count()).toBe(1);
    const next = await preview(await account(), "CSV");
    expect(next.rows).toMatchObject([
      { categoryId: dining.id, categorySource: "rule" },
      { categoryId: dining.id, categorySource: "rule" },
    ]);
    const changed = updateImportRows(next.rows, 1, {
      categoryId: groceries.id,
      rememberCategory: true,
    });
    expect((await post(next.path, { rows: changed })).status).toBe(200);
    expect(await prisma.rule.findMany()).toMatchObject([
      { categoryId: groceries.id },
    ]);
    expect(await prisma.rule.count()).toBe(1);
    const unrelated = await post("/transactions", {
      accountId,
      date: today(),
      description: "Local Shop Online",
      kind: "expense",
      amountCents: 10,
    });
    expect(unrelated.body.categoryId).toBeNull();
  },
);

it("rolls back transactions and rules on invalid remembering and ignores excluded rows", async () => {
  const result = await preview(await account(), "CSV");
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const rows = result.rows.map((row: object) => ({
    ...row,
    rememberCategory: true,
    categoryId: dining.id,
  }));
  rows[1].categoryId = null;
  expect((await post(result.path, { rows })).status).toBe(400);
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.rule.count()).toBe(0);
  rows[0].rememberCategory = false;
  rows[1].include = false;
  expect((await post(result.path, { rows })).body.imported).toBe(1);
  expect(await prisma.rule.count()).toBe(0);
});

it("serialises remembered rules from concurrent imports into different accounts", async () => {
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const previews = await Promise.all(
    [account(), account()].map(async (id) => preview(await id, "CSV")),
  );
  const responses = await Promise.all(
    previews.map((item) =>
      post(item.path, {
        rows: updateImportRows(item.rows, 1, {
          categoryId: dining.id,
          rememberCategory: true,
        }),
      }),
    ),
  );
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  expect(await prisma.transaction.count()).toBe(4);
  expect(await prisma.rule.count()).toBe(1);
});

it("saves changing bank references as one contains rule and rejects non-matching remembered text atomically", async () => {
  const accountId = await account();
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Salary" },
  });
  const csv = `Date,Description,Amount\n${today()},Direct Credit 396297 IVV PAYMENT OCT26/00823316,10.00\n${today()},Direct Credit 396297 IVV PAYMENT JUL26/00823296,20.00`;
  const headers = await post("/imports/headers", { csv, accountId });
  const result = await post("/imports/preview", {
    csv,
    accountId,
    mapping: headers.body.mapping,
  });
  const rows = updateImportRows(result.body.rows, 1, {
    categoryId: category.id,
    rememberCategory: true,
  });
  const path = `/imports/${result.body.id}/commit`;
  expect(
    (
      await post(path, {
        rows: rows.map((row, i) =>
          i ? row : { ...row, rememberPattern: "Different issuer" },
        ),
      })
    ).status,
  ).toBe(400);
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.rule.count()).toBe(0);
  expect((await post(path, { rows })).status).toBe(200);
  expect(await prisma.rule.findMany()).toMatchObject([
    {
      pattern: "direct credit 396297 ivv payment",
      matchMode: "contains",
      categoryId: category.id,
    },
  ]);
  const future = csv
    .replace("OCT26/00823316", "JAN27/00823999")
    .replace("JUL26/00823296", "APR27/00824444");
  const next = await post("/imports/preview", {
    csv: future,
    accountId,
    mapping: headers.body.mapping,
  });
  expect(next.body.rows).toMatchObject([
    { categoryId: category.id, categorySource: "rule" },
    { categoryId: category.id, categorySource: "rule" },
  ]);
});
