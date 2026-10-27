import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { account, memberCookie, origin, post } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { bankLayoutStatement } from "./bank-layout-fixture.js";
import { statementPdf } from "./statement-fixture.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
import type { StatementPreview } from "@finance/shared";

async function preview() {
  const accountId = await account();
  const uploaded = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", statementPdf(bankLayoutStatement()), "bank.pdf");
  expect(uploaded.status, uploaded.body.error).toBe(202);
  const job = await claimStatement();
  expect(job?.id).toBe(uploaded.body.id);
  await processClaimedStatement(job!);
  const result = await statementPreview(job!.id);
  expect(result.status).toBe("ready");
  return result as StatementPreview;
}
const commitBody = (p: StatementPreview) => ({
  rows: p.rows,
  reviewed: true,
  applyOpening: true,
  opening: p.details.opening,
  schedules: [],
});

it("imports a cross-year PDF using posting dates, complete descriptions and exact source totals", async () => {
  const p = await preview();
  expect(p.pages).toBe(3);
  expect(p.rows).toHaveLength(5);
  expect(p.rows.every((row) => row.include && !row.error)).toBe(true);
  expect(p.details.warnings).toEqual([]);
  const committed = await post(
    "/statements/" + p.id + "/commit",
    commitBody(p),
  );
  expect(committed.status, committed.body.error).toBe(200);
  const rows = await prisma.transaction.findMany({ orderBy: { date: "asc" } });
  expect(rows.map((row) => row.date)).toEqual([
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
  ]);
  expect(rows[1]?.description).toBe("To: Property Team 3/14 Example - rent");
  expect(rows.reduce((sum, row) => sum + Number(row.amountCents), 50000)).toBe(
    57000,
  );
  const reread = await post("/statements/" + p.id + "/retry", {
    discardReview: true,
  });
  expect(reread.status).toBe(409);
  expect(reread.body.error).toContain("already been imported");
  expect(await prisma.transaction.count()).toBe(5);
});

it("requires confirmation before replacing a saved empty review and regenerates it from the stored PDF", async () => {
  const p = await preview();
  const statement = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
  });
  // Reproduce an old reader's durable zero-row preview without a real bank PDF.
  await prisma.importBatch.update({
    where: { id: statement.importBatchId },
    data: { preview: [] },
  });
  expect((await post("/statements/" + p.id + "/retry", {})).status).toBe(400);
  expect((await statementPreview(p.id)).status).toBe("ready");
  const attempts = await Promise.all([
    post("/statements/" + p.id + "/retry", { discardReview: true }),
    post("/statements/" + p.id + "/retry", { discardReview: true }),
  ]);
  expect(attempts.map((attempt) => attempt.status).sort()).toEqual([202, 409]);
  expect((await statementPreview(p.id)).status).toBe("queued");
  expect(await prisma.transaction.count()).toBe(0);
  await processClaimedStatement((await claimStatement())!);
  const reread = await statementPreview(p.id);
  expect(reread.status).toBe("ready");
  if (reread.status !== "ready") throw new Error("Statement did not finish");
  expect(reread.rows).toEqual(p.rows);
  expect(reread.details.warnings).toEqual([]);
  expect(await prisma.statement.count()).toBe(1);
});

it("serializes read-again and commit so a statement is never both posted and requeued", async () => {
  const p = await preview();
  const [retry, commit] = await Promise.all([
    post("/statements/" + p.id + "/retry", { discardReview: true }),
    post("/statements/" + p.id + "/commit", commitBody(p)),
  ]);
  const saved = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
    include: { importBatch: true },
  });
  if (retry.status === 202) {
    expect(commit.status).toBe(409);
    expect(saved.status).toBe("queued");
    expect(saved.importBatch.committedAt).toBeNull();
    expect(await prisma.transaction.count()).toBe(0);
  } else {
    expect(retry.status).toBe(409);
    expect(commit.status, commit.body.error).toBe(200);
    expect(saved.status).toBe("ready");
    expect(saved.importBatch.committedAt).not.toBeNull();
    expect(await prisma.transaction.count()).toBe(5);
  }
});
