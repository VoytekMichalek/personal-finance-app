import "./fixtures.js";
import { prisma } from "../lib/db.js";
import { today } from "@finance/shared";
import { describe, expect, it } from "vitest";
import {
  account,
  adminCookie,
  agent,
  memberCookie,
  memberId,
  post,
  put,
} from "./fixtures.js";
describe("persistent financial operations", () => {
  it("records transfer sides atomically without counting income or expenses", async () => {
    const from = await account();
    const to = await account();
    expect(
      (
        await post("/transfers", {
          fromAccountId: from,
          toAccountId: to,
          date: today(),
          amountCents: 1500,
        })
      ).status,
    ).toBe(201);
    const rows = await prisma.transaction.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((s, t) => s + Number(t.amountCents), 0)).toBe(0);
    expect(new Set(rows.map((t) => t.transferGroupId)).size).toBe(1);
  });
  it("rejects stale concurrent transaction edits", async () => {
    const accountId = await account();
    const body = {
      accountId,
      date: today(),
      description: "Shop",
      amountCents: 1000,
      kind: "expense",
    };
    const created = await post("/transactions", body);
    const responses = await Promise.all([
      put("/transactions/" + created.body.id, {
        ...body,
        description: "One",
        version: 1,
      }),
      put("/transactions/" + created.body.id, {
        ...body,
        description: "Two",
        version: 1,
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await prisma.transaction.findUnique({ where: { id: created.body.id } }))
        ?.version,
    ).toBe(2);
  });
  it("retains financial attribution when a user is deleted", async () => {
    const accountId = await account();
    const record = await post("/transactions", {
      accountId,
      date: today(),
      description: "Personal shop",
      amountCents: 1000,
      kind: "expense",
      owner: memberId,
    });
    expect(
      (await post("/access/users/" + memberId + "/delete", {}, adminCookie))
        .status,
    ).toBe(200);
    expect(
      (await prisma.transaction.findUnique({ where: { id: record.body.id } }))
        ?.owner,
    ).toBe(memberId);
    expect((await agent(memberCookie)).status).toBe(401);
  });
  it("rolls back mixed-kind bulk categorisation", async () => {
    const accountId = await account();
    const expense = await post("/transactions", {
      accountId,
      date: today(),
      description: "Shop",
      amountCents: 1000,
      kind: "expense",
    });
    const income = await post("/transactions", {
      accountId,
      date: today(),
      description: "Pay",
      amountCents: 1000,
      kind: "income",
    });
    const category = await prisma.category.findFirstOrThrow({
      where: { kind: "expense" },
    });
    expect(
      (
        await post("/transactions/bulk-category", {
          categoryId: category.id,
          records: [
            { id: expense.body.id, version: 1 },
            { id: income.body.id, version: 1 },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (await prisma.transaction.findUnique({ where: { id: expense.body.id } }))
        ?.categoryId,
    ).toBeNull();
  });
  it("consumes each schedule occurrence once under concurrency", async () => {
    const accountId = await account();
    const created = await post("/schedules", {
      name: "Bill",
      accountId,
      amountCents: 5000,
      kind: "expense",
      frequency: "monthly",
      startDate: today(),
    });
    const results = await Promise.all([
      post("/schedules/" + created.body.id + "/match", { date: today() }),
      post("/schedules/" + created.body.id + "/match", { date: today() }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.transaction.count()).toBe(1);
  });
  it("imports legitimate duplicate source rows once despite concurrent confirmation", async () => {
    const accountId = await account();
    const date = today().split("-").reverse().join("/");
    const csv =
      "Date,Description,Amount\n" +
      date +
      ",Shop,-1.00\n" +
      date +
      ",Shop,-1.00";
    const preview = await post("/imports/preview", {
      accountId,
      csv,
      mapping: {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
        dateFormat: "DMY",
      },
    });
    expect(preview.status).toBe(200);
    const responses = await Promise.all([
      post("/imports/" + preview.body.id + "/commit", {
        rows: preview.body.rows,
      }),
      post("/imports/" + preview.body.id + "/commit", {
        rows: preview.body.rows,
      }),
    ]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await prisma.transaction.count()).toBe(2);
    expect(responses.some((r) => r.body.alreadyImported)).toBe(true);
    const repeated = await post("/imports/preview", {
      accountId,
      csv,
      mapping: {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
        dateFormat: "DMY",
      },
    });
    expect(
      (
        await post("/imports/" + repeated.body.id + "/commit", {
          rows: repeated.body.rows,
        })
      ).body.alreadyImported,
    ).toBe(true);
  });
  it("rejects tampered source amounts and rolls back all imported rows", async () => {
    const accountId = await account();
    const date = today().split("-").reverse().join("/");
    const preview = await post("/imports/preview", {
      accountId,
      csv:
        "Date,Description,Amount\n" +
        date +
        ",Shop,-1.00\n" +
        date +
        ",Train,-2.00",
      mapping: {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
        dateFormat: "DMY",
      },
    });
    preview.body.rows[1].amountCents = -999;
    expect(
      (
        await post("/imports/" + preview.body.id + "/commit", {
          rows: preview.body.rows,
        })
      ).status,
    ).toBe(400);
    expect(await prisma.transaction.count()).toBe(0);
  });
  it("imports refunds and linked repayments and flags the counterpart on later statements", async () => {
    const source = await account();
    const other = await account();
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    const mapping = {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      dateFormat: "ISO",
    };
    const preview = await post("/imports/preview", {
      accountId: source,
      csv:
        "Date,Description,Amount\n" +
        today() +
        ",Card repayment,-20\n" +
        today() +
        ",Returned item,5",
      mapping,
    });
    const rows = preview.body.rows;
    rows[0].kind = "transfer";
    rows[0].counterAccountId = other;
    rows[1].kind = "refund";
    rows[1].categoryId = category.id;
    const result = await post("/imports/" + preview.body.id + "/commit", {
      rows,
    });
    expect(result.status).toBe(200);
    expect(result.body.imported).toBe(2);
    const recorded = await prisma.transaction.findMany();
    expect(recorded.filter((t) => t.kind === "transfer")).toHaveLength(2);
    expect(recorded.find((t) => t.kind === "refund")?.amountCents).toBe(500n);
    expect(
      (await post("/imports/" + preview.body.id + "/commit", { rows })).body
        .imported,
    ).toBe(2);
    const counterpart = await post("/imports/preview", {
      accountId: other,
      csv:
        "Date,Description,Amount\n" + today() + ",Different bank narrative,20",
      mapping,
    });
    expect(counterpart.body.rows[0].duplicate).toBe(true);
    expect(counterpart.body.rows[0].include).toBe(false);
  });
  it("respects explicitly uncategorised transactions ahead of merchant rules", async () => {
    const accountId = await account();
    const category = await prisma.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    await post("/rules", { pattern: "Shop", categoryId: category.id });
    const body = {
      accountId,
      kind: "expense",
      amountCents: 100,
      date: today(),
      description: "Shop",
    };
    expect(
      (await post("/transactions", { ...body, categoryId: null })).body
        .categoryId,
    ).toBeNull();
    expect((await post("/transactions", body)).body.categoryId).toBe(
      category.id,
    );
  });
});
