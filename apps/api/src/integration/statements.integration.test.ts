import "./fixtures.js";
import { it, expect } from "vitest";
import request from "supertest";
import { prisma } from "../lib/db.js";
import { app } from "../app.js";
import { post, put, memberCookie, origin, account } from "./fixtures.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
import { statementPdf, sixMonthStatement } from "./statement-fixture.js";
import {
  accountBalance,
  type StatementPreview,
  type Account,
  type Transaction,
} from "@finance/shared";
async function finish(id: string) {
  const job = await claimStatement();
  expect(job?.id).toBe(id);
  await processClaimedStatement(job!);
  const result = await statementPreview(id);
  expect(result.status).toBe("ready");
  return result as StatementPreview;
}
async function preview() {
  const accountId = await account();
  const result = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", statementPdf(sixMonthStatement()), "six-months.pdf");
  expect(result.status, result.body.error).toBe(202);
  return finish(result.body.id);
}
const body = (p: StatementPreview) => ({
  rows: p.rows,
  applyOpening: true,
  opening: p.details.opening,
  reviewed: true,
  schedules: p.details.recurring.map((r) => ({
    key: r.key,
    schedule: r.schedule,
  })),
});
it("uploads all pages privately and atomically imports opening, rows and accepted recurring items once", async () => {
  const p = await preview();
  expect(p.pages).toBe(6);
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.schedule.count()).toBe(0);
  expect(
    (await request(app).get("/api/statements/" + p.id + "/file")).status,
  ).toBe(401);
  const file = await request(app)
    .get("/api/statements/" + p.id + "/file")
    .set("Cookie", memberCookie);
  expect(file.status).toBe(200);
  expect(file.headers["content-type"]).toContain("application/pdf");
  // Durable PDF reviews remain usable when returning after the CSV preview window.
  const stored = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
  });
  await prisma.importBatch.update({
    where: { id: stored.importBatchId },
    data: { expiresAt: new Date(0) },
  });
  const results = await Promise.all([
    post("/statements/" + p.id + "/commit", body(p)),
    post("/statements/" + p.id + "/commit", body(p)),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results.filter((r) => r.body.alreadyImported)).toHaveLength(1);
  expect(await prisma.transaction.count()).toBe(12);
  expect(await prisma.schedule.count()).toBe(2);
  expect(
    (await prisma.account.findUniqueOrThrow({ where: { id: p.accountId } }))
      .openingDate,
  ).toBe("2026-01-01");
});
it("rejects edited source amounts, unreviewed confirmation and invalid schedules without partial writes", async () => {
  const p = await preview();
  const changed = structuredClone(body(p));
  changed.rows[0]!.amountCents++;
  expect((await post("/statements/" + p.id + "/commit", changed)).status).toBe(
    400,
  );
  expect(
    (
      await post("/statements/" + p.id + "/commit", {
        ...body(p),
        reviewed: false,
      })
    ).status,
  ).toBe(400);
  const invalid = body(p);
  invalid.schedules[0]!.schedule.accountId = crypto.randomUUID();
  expect((await post("/statements/" + p.id + "/commit", invalid)).status).toBe(
    400,
  );
  expect(await prisma.transaction.count()).toBe(0);
  expect(await prisma.schedule.count()).toBe(0);
  expect(
    (await prisma.account.findUniqueOrThrow({ where: { id: p.accountId } }))
      .openingDate,
  ).not.toBe("2026-01-01");
  const batch = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
  });
  expect(
    (
      await post("/imports/" + batch.importBatchId + "/commit", {
        rows: p.rows,
      })
    ).status,
  ).toBe(400);
});
it("preserves existing account opening balances and defaults recurring acceptance to none", async () => {
  const p = await preview();
  expect(
    (
      await post("/statements/" + p.id + "/commit", {
        ...body(p),
        schedules: [],
      })
    ).status,
  ).toBe(200);
  expect(await prisma.schedule.count()).toBe(0);
  const duplicate = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", p.accountId)
    .attach("file", statementPdf(sixMonthStatement()), "again.pdf");
  expect(duplicate.body.id).toBe(p.id);
  expect(duplicate.body.committedAt).toBeTruthy();
});
it("supports subcategories while rejecting cycles, kind mismatches and removal of used history", async () => {
  const parent = (
    await post("/categories", { name: "Test home", kind: "expense" })
  ).body;
  const child = (
    await post("/categories", {
      name: "Power",
      kind: "expense",
      parentId: parent.id,
    })
  ).body;
  expect(child.parentId).toBe(parent.id);
  expect(
    (await put("/categories/" + parent.id, { ...parent, parentId: child.id }))
      .status,
  ).toBe(400);
  expect(
    (
      await post("/categories", {
        name: "Bad",
        kind: "income",
        parentId: parent.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (await put("/categories/" + parent.id, { ...parent, archived: true }))
      .status,
  ).toBe(200);
  expect(
    (await prisma.category.findUniqueOrThrow({ where: { id: child.id } }))
      .archived,
  ).toBe(true);
  expect(
    (
      await request(app)
        .delete("/api/categories/" + parent.id)
        .set("Origin", origin)
        .set("Cookie", memberCookie)
    ).status,
  ).toBe(409);
  await prisma.category.delete({ where: { id: child.id } });
  await prisma.category.delete({ where: { id: parent.id } });
});

it("imports card debt, expenses, refunds and linked repayments without treating repayments as income", async () => {
  const card = (
    await post("/accounts", {
      name: "Credit",
      type: "credit",
      openingDate: "2026-01-01",
      openingBalanceCents: 0,
    })
  ).body;
  const bank = (
    await post("/accounts", {
      name: "Bank",
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents: 100000,
    })
  ).body;
  const pdf = statementPdf([
    [
      "2026",
      "Opening balance 500.00",
      "Date Details Amount Balance",
      "01/01/2026 Coles 80.00 580.00",
      "02/01/2026 Payment received 200.00 CR 380.00",
      "03/01/2026 Coles refund 20.00 CR 360.00",
      "Closing balance 360.00",
    ],
  ]);
  const response = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", card.id)
    .attach("file", pdf, "card.pdf");
  expect(response.status, response.body.error).toBe(202);
  const p = await finish(response.body.id);
  expect(p.rows.map((r) => r.kind)).toEqual(["expense", "transfer", "refund"]);
  expect((await post("/statements/" + p.id + "/commit", body(p))).status).toBe(
    400,
  );
  expect(await prisma.transaction.count()).toBe(0);
  p.rows[1]!.counterAccountId = bank.id;
  const existing = await post("/transactions", {
    accountId: bank.id,
    kind: "expense",
    amountCents: 20000,
    date: "2026-01-02",
    description: "Previously entered card payment",
  });
  expect(existing.status).toBe(201);
  const duplicate = await post("/statements/" + p.id + "/commit", body(p));
  expect(duplicate.status).toBe(409);
  expect(
    await prisma.transaction.count({ where: { accountId: card.id } }),
  ).toBe(0);
  await prisma.transaction.delete({ where: { id: existing.body.id } });
  const committed = await post("/statements/" + p.id + "/commit", body(p));
  expect(committed.status, committed.body.error).toBe(200);
  const txs = await prisma.transaction.findMany();
  const ledger = txs.map((t) => ({
    ...t,
    amountCents: Number(t.amountCents),
  })) as Transaction[];
  const stored = await prisma.account.findUniqueOrThrow({
    where: { id: card.id },
  });
  const balance = accountBalance(
    {
      ...stored,
      openingBalanceCents: Number(stored.openingBalanceCents),
    } as Account,
    ledger,
    "2026-10-10",
  );
  expect(balance).toBe(-36000);
  expect(accountBalance(bank, ledger, "2026-10-10")).toBe(80000);
  expect(ledger.filter((t) => t.kind === "income")).toHaveLength(0);
  expect(
    ledger
      .filter((t) => t.kind === "expense" || t.kind === "refund")
      .reduce((s, t) => s + t.amountCents, 0),
  ).toBe(-6000);
  expect(
    ledger
      .filter((t) => t.kind === "transfer")
      .reduce((s, t) => s + t.amountCents, 0),
  ).toBe(0);
  expect(
    new Set(
      ledger.filter((t) => t.kind === "transfer").map((t) => t.transferGroupId),
    ).size,
  ).toBe(1);
});

it("accepts an earlier opening anchor without changing source dates or amounts", async () => {
  const p = await preview();
  const input = body(p);
  input.opening = { ...p.details.opening!, date: "2025-12-31" };
  const result = await post("/statements/" + p.id + "/commit", input);
  expect(result.status, result.body.error).toBe(200);
  expect(
    (await prisma.account.findUniqueOrThrow({ where: { id: p.accountId } }))
      .openingDate,
  ).toBe("2025-12-31");
  expect(
    (await prisma.transaction.findFirstOrThrow({ orderBy: { date: "asc" } }))
      .date,
  ).toBe("2026-01-01");
});
it("identifies the other account in an early card repayment and succeeds after fixing that opening date", async () => {
  const card = await post("/accounts", {
    name: "Card",
    type: "credit",
    openingDate: "2026-01-07",
    openingBalanceCents: 0,
  });
  const bank = await post("/accounts", {
    name: "Paying bank",
    type: "bank",
    openingDate: "2026-01-07",
    openingBalanceCents: 100000,
  });
  const uploaded = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", card.body.id)
    .attach(
      "file",
      statementPdf([
        "2026\nPrevious balance 500.00\nDate Details Amount\n05/01/2026 Payment received 100.00 CR\nNew balance 400.00".split(
          "\n",
        ),
      ]),
      "card.pdf",
    );
  const p = await finish(uploaded.body.id);
  p.rows[0]!.counterAccountId = bank.body.id;
  const failed = await post("/statements/" + p.id + "/commit", body(p));
  expect(failed.status).toBe(400);
  expect(failed.body.error).toContain("Paying bank");
  expect(failed.body.error).toContain("2026-01-07");
  expect(await prisma.transaction.count()).toBe(0);
  await put("/accounts/" + bank.body.id, {
    ...bank.body,
    openingDate: "2026-01-01",
  });
  const result = await post("/statements/" + p.id + "/commit", body(p));
  expect(result.status, result.body.error).toBe(200);
  expect(await prisma.transaction.count({ where: { kind: "transfer" } })).toBe(
    2,
  );
});

it("accepts a reviewed quarterly insurance candidate with two payments and rejects insufficient selected evidence", async () => {
  const accountId = await account();
  const upload = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach(
      "file",
      statementPdf([
        [
          "2026",
          "Opening balance 1000.00",
          "05/01/2026 ALLIANZ INSURANCE -100.00",
          "05/04/2026 ALLIANZ INSURANCE -100.00",
          "Closing balance 800.00",
        ],
      ]),
      "quarterly.pdf",
    );
  const p = await finish(upload.body.id);
  expect(p.details.recurring).toHaveLength(1);
  const input = body(p);
  input.rows = input.rows.map((r, i) => ({ ...r, include: i === 0 }));
  expect((await post("/statements/" + p.id + "/commit", input)).status).toBe(
    400,
  );
  expect(await prisma.transaction.count()).toBe(0);
  const accepted = await post("/statements/" + p.id + "/commit", body(p));
  expect(accepted.status, accepted.body.error).toBe(200);
  expect(await prisma.schedule.count()).toBe(1);
});
it("uses an account's owner for manual spending when the request omits owner", async () => {
  const person = await prisma.user.findFirstOrThrow({
    where: { role: "member" },
  });
  const owned = await post("/accounts", {
    name: "Personal bank",
    owner: person.id,
    type: "bank",
    openingDate: "2026-01-01",
    openingBalanceCents: 0,
  });
  const result = await post("/transactions", {
    accountId: owned.body.id,
    kind: "expense",
    amountCents: 100,
    date: "2026-01-05",
    description: "Coffee",
  });
  expect(result.status, result.body.error).toBe(201);
  expect(result.body.owner).toBe(person.id);
});

it("reviews additional recurring items from posted statement evidence without importing twice", async () => {
  const p = await preview();
  const imported = await post("/statements/" + p.id + "/commit", {
    ...body(p),
    schedules: [],
  });
  expect(imported.status).toBe(200);
  const ledgerBefore = await prisma.transaction.findMany({
    orderBy: { id: "asc" },
  });
  const suggestions = await request(app)
    .get("/api/statements/" + p.id + "/recurring")
    .set("Cookie", memberCookie);
  expect(suggestions.status).toBe(200);
  expect(suggestions.body).toHaveLength(2);
  const accepted = { reviewed: true, schedules: suggestions.body };
  expect(
    (
      await post("/statements/" + p.id + "/recurring", {
        ...accepted,
        reviewed: false,
      })
    ).status,
  ).toBe(400);
  expect(
    (await post("/statements/" + p.id + "/recurring", accepted)).status,
  ).toBe(200);
  expect(await prisma.transaction.findMany({ orderBy: { id: "asc" } })).toEqual(
    ledgerBefore,
  );
  expect(await prisma.schedule.count()).toBe(2);
  expect(
    (
      await request(app)
        .get("/api/statements/" + p.id + "/recurring")
        .set("Cookie", memberCookie)
    ).body,
  ).toEqual([]);
  expect(
    (await post("/statements/" + p.id + "/recurring", accepted)).status,
  ).toBe(400);
  expect(await prisma.schedule.count()).toBe(2);
});
