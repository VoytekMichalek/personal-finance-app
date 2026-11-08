import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { account, memberCookie, origin, post } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { qantasPdf } from "./qantas-fixture.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
import type { StatementPreview } from "@finance/shared";

async function preview(incomplete = false) {
  const accountId = await account();
  await prisma.account.update({
    where: { id: accountId },
    data: { openingDate: "2025-01-01", openingBalanceCents: 0n },
  });
  const uploaded = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", qantasPdf(incomplete), "synthetic-qantas.pdf");
  expect(uploaded.status, uploaded.body.error).toBe(202);
  const job = await claimStatement();
  expect(job?.id).toBe(uploaded.body.id);
  await processClaimedStatement(job!);
  const result = await statementPreview(job!.id);
  expect(result.status).toBe("ready");
  return result as StatementPreview;
}

it("persists and re-reads Qantas source evidence, protects dates/amounts and imports refunds and linked reloads once", async () => {
  const p = await preview();
  expect(p.rows.map((row) => row.amountCents)).toEqual([
    -1234, 325, -750, 10000, -2000,
  ]);
  expect(p.rows[1]?.kind).toBe("refund");
  expect(p.rows[3]?.kind).toBe("transfer");
  const saved = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
  });
  await prisma.importBatch.update({
    where: { id: saved.importBatchId },
    data: { preview: [] },
  });
  expect(
    (await post(`/statements/${p.id}/retry`, { discardReview: true })).status,
  ).toBe(202);
  await processClaimedStatement((await claimStatement())!);
  const reread = (await statementPreview(p.id)) as StatementPreview;
  expect(reread.rows).toEqual(p.rows);
  const funding = await account();
  await prisma.account.update({
    where: { id: funding },
    data: { openingDate: "2025-01-01" },
  });
  reread.rows[3]!.counterAccountId = funding;
  const body = {
    rows: reread.rows,
    reviewed: true,
    applyOpening: true,
    opening: reread.details.opening,
    schedules: [],
  };
  for (const change of [{ amountCents: -500 }, { date: "2026-01-05" }]) {
    const tampered = structuredClone(body);
    Object.assign(tampered.rows[2]!, change);
    expect((await post(`/statements/${p.id}/commit`, tampered)).status).toBe(
      400,
    );
    expect(await prisma.transaction.count()).toBe(0);
  }
  const committed = await post(`/statements/${p.id}/commit`, body);
  expect(committed.status, committed.body.error).toBe(200);
  const transactions = await prisma.transaction.findMany({
    where: { accountId: p.accountId },
  });
  expect(transactions).toHaveLength(5);
  expect(
    transactions.reduce((sum, row) => sum + Number(row.amountCents), 50000),
  ).toBe(56341);
  expect(transactions.find((row) => row.kind === "refund")?.amountCents).toBe(
    325n,
  );
  const transfers = await prisma.transaction.findMany({
    where: { kind: "transfer" },
  });
  expect(transfers).toHaveLength(2);
  expect(
    transfers.map((row) => Number(row.amountCents)).sort((a, b) => a - b),
  ).toEqual([-10000, 10000]);
  expect((await post(`/statements/${p.id}/commit`, body)).status).toBe(200);
  expect(await prisma.transaction.count()).toBe(6);
});

it("keeps the undated orphan and reconciliation warning visible after preview reload without fabricating a payment", async () => {
  const p = await preview(true);
  const response = await request(app)
    .get(`/api/statements/${p.id}`)
    .set("Cookie", memberCookie);
  expect(response.status).toBe(200);
  const reloaded = response.body as StatementPreview;
  expect(reloaded.rows).toHaveLength(5);
  expect(reloaded.rows.some((row) => row.amountCents === -999)).toBe(false);
  expect(reloaded.details.closing?.amountCents).toBe(55342);
  expect(
    reloaded.details.lines.find((line) => line.text.includes("-9.99 AUD")),
  ).toMatchObject({ status: "review", rowNumber: null });
  expect(reloaded.details.warnings.join(" ")).toContain("does not match");
  expect(await prisma.transaction.count()).toBe(0);
});
