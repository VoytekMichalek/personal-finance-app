import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../lib/db.js";
import { app } from "../app.js";
import { account, memberCookie, origin, post, put } from "./fixtures.js";
import { statementPdf } from "./statement-fixture.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
import type { StatementPreview } from "@finance/shared";

async function preview(lines = ["12 Oct Shop -20.00", "13 Oct Shop -10.00"]) {
  const accountId = await account();
  await prisma.account.update({
    where: { id: accountId },
    data: { openingDate: "2024-01-01" },
  });
  const result = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach(
      "file",
      statementPdf([["Bank statement", "Date Details Amount", ...lines]]),
      "missing-years.pdf",
    );
  expect(result.status, result.body.error).toBe(202);
  const job = await claimStatement();
  expect(job?.id).toBe(result.body.id);
  await processClaimedStatement(job!);
  return (await statementPreview(result.body.id)) as StatementPreview;
}
const corrections = [
  { rowNumber: 1, date: "2026-10-12" },
  { rowNumber: 2, date: "2026-10-13" },
];

it("refreshes saved unimported reviews from current rules without rewriting committed transactions", async () => {
  const p = await preview(["12 Oct 2026 Local shop -20.00"]);
  expect(p.rows[0]?.categoryId).toBeNull();
  const groceries = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const dining = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const rule = await post("/rules", {
    pattern: "Local shop",
    categoryId: groceries.id,
  });
  expect(rule.status).toBe(200);
  expect(
    ((await statementPreview(p.id)) as StatementPreview).rows[0],
  ).toMatchObject({ categoryId: groceries.id, categorySource: "rule" });
  expect(
    (
      await put("/rules/" + rule.body.id, {
        ...rule.body,
        categoryId: dining.id,
      })
    ).status,
  ).toBe(200);
  const current = (await statementPreview(p.id)) as StatementPreview;
  expect(current.rows[0]?.categoryId).toBe(dining.id);
  expect(
    (
      await post(`/statements/${p.id}/commit`, {
        rows: current.rows,
        reviewed: true,
        applyOpening: false,
        opening: null,
        schedules: [],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await put("/rules/" + rule.body.id, {
        ...rule.body,
        categoryId: groceries.id,
      })
    ).status,
  ).toBe(200);
  await statementPreview(p.id);
  expect(
    (await prisma.transaction.findMany()).map((r) => r.categoryId),
  ).toEqual([dining.id]);
});

it("repairs missing PDF years durably, flags duplicates and still enforces source amounts on commit", async () => {
  const p = await preview();
  expect(p.rows).toHaveLength(2);
  expect(p.rows.every((row) => !row.date && row.error)).toBe(true);
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  await post("/rules", { pattern: "Shop", categoryId: category.id });
  await post("/transactions", {
    accountId: p.accountId,
    kind: "expense",
    date: "2026-10-13",
    amountCents: 1000,
    description: "Existing payment",
  });
  const response = await post(`/statements/${p.id}/dates`, { corrections });
  expect(response.status, response.body.error).toBe(200);
  const repaired = response.body as StatementPreview;
  expect(repaired.rows[0]).toMatchObject({
    date: "2026-10-12",
    amountCents: -2000,
    include: true,
    error: null,
    categoryId: category.id,
    categorySource: "rule",
  });
  expect(repaired.rows[1]).toMatchObject({
    date: "2026-10-13",
    amountCents: -1000,
    include: false,
    duplicate: true,
    error: null,
  });
  expect(((await statementPreview(p.id)) as StatementPreview).rows).toEqual(
    repaired.rows,
  );
  const body = {
    rows: repaired.rows,
    reviewed: true,
    applyOpening: false,
    opening: null,
    schedules: [],
  };
  const changed = structuredClone(body);
  changed.rows[0]!.amountCents = -2001;
  expect((await post(`/statements/${p.id}/commit`, changed)).status).toBe(400);
  expect((await post(`/statements/${p.id}/commit`, body)).status).toBe(200);
  expect(await prisma.transaction.count()).toBe(2);
  expect(
    (await post(`/statements/${p.id}/dates`, { corrections })).status,
  ).toBe(409);
});

it("rejects changing the printed day/month and rolls back an earlier valid correction", async () => {
  const p = await preview();
  const response = await post(`/statements/${p.id}/dates`, {
    corrections: [corrections[0], { rowNumber: 2, date: "2026-10-14" }],
  });
  expect(response.status).toBe(400);
  expect(response.body.error).toContain("printed in the PDF");
  expect(
    ((await statementPreview(p.id)) as StatementPreview).rows.every(
      (row) => !row.date,
    ),
  ).toBe(true);
  expect(await prisma.transaction.count()).toBe(0);
});

it("rejects future dates, invalid leap days, duplicate row choices and unauthenticated corrections", async () => {
  const p = await preview(["29 Feb Shop -20.00"]);
  expect(
    (
      await post(`/statements/${p.id}/dates`, {
        corrections: [{ rowNumber: 1, date: "2025-02-29" }],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post(`/statements/${p.id}/dates`, {
        corrections: [{ rowNumber: 1, date: "2028-02-29" }],
      })
    ).status,
  ).toBe(400);
  const leap = { rowNumber: 1, date: "2024-02-29" };
  expect(
    (await post(`/statements/${p.id}/dates`, { corrections: [leap, leap] }))
      .status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post(`/api/statements/${p.id}/dates`)
        .set("Origin", origin)
        .send({ corrections: [leap] })
    ).status,
  ).toBe(401);
  expect(
    (await post(`/statements/${p.id}/dates`, { corrections: [leap] })).status,
  ).toBe(200);
});

it("preserves a printed year and rejects stale corrections after another reviewer fixes the date", async () => {
  const future = await preview(["12 Oct 2099 Shop -20.00"]);
  expect(
    (
      await post(`/statements/${future.id}/dates`, {
        corrections: [corrections[0]],
      })
    ).status,
  ).toBe(400);
  const p = await preview();
  const results = await Promise.all([
    post(`/statements/${p.id}/dates`, { corrections }),
    post(`/statements/${p.id}/dates`, { corrections }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect(
    ((await statementPreview(p.id)) as StatementPreview).rows.every(
      (row) => !row.error,
    ),
  ).toBe(true);
});

it("can change reading options on the saved PDF and retry without AI while preserving the ready-review confirmation safeguard", async () => {
  const p = await preview();
  await prisma.statement.update({
    where: { id: p.id },
    data: { processingOptions: { useAi: true, modelId: "unavailable" } },
  });
  expect(
    (await post(`/statements/${p.id}/retry`, { year: 2026, useAi: false }))
      .status,
  ).toBe(400);
  expect(
    (
      await post(`/statements/${p.id}/retry`, {
        discardReview: true,
        year: 9999,
        useAi: false,
      })
    ).status,
  ).toBe(400);
  const retry = await post(`/statements/${p.id}/retry`, {
    discardReview: true,
    year: 2026,
    useAi: false,
  });
  expect(retry.status, retry.body.error).toBe(202);
  expect(
    (await prisma.statement.findUniqueOrThrow({ where: { id: p.id } }))
      .processingOptions,
  ).toMatchObject({ year: 2026, useAi: false });
  const job = await claimStatement();
  await processClaimedStatement(job!);
  const result = (await statementPreview(p.id)) as StatementPreview;
  expect(result.rows.map((row) => row.date)).toEqual([
    "2026-10-12",
    "2026-10-13",
  ]);
  expect(result.rows.every((row) => !row.error)).toBe(true);
  expect(await prisma.transaction.count()).toBe(0);
});
