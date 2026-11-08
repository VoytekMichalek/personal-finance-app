import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { account, memberCookie, origin, post } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { hsbcStatement, hsbcHeading, hsbcRow } from "./hsbc-fixture.js";
import { statementPdf } from "./statement-fixture.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
import type { StatementPreview } from "@finance/shared";

async function preview(pages = hsbcStatement()) {
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
    .attach("file", statementPdf(pages), "synthetic-hsbc.pdf");
  expect(uploaded.status, uploaded.body.error).toBe(202);
  const job = await claimStatement();
  expect(job?.id).toBe(uploaded.body.id);
  await processClaimedStatement(job!);
  const result = await statementPreview(job!.id);
  expect(result.status).toBe("ready");
  return result as StatementPreview;
}

it("re-reads an older partial HSBC review and commits all grouped rows once with protected source values", async () => {
  const p = await preview();
  expect(p.rows).toHaveLength(9);
  expect(p.details.warnings).toEqual([]);
  const statement = await prisma.statement.findUniqueOrThrow({
    where: { id: p.id },
  });
  await prisma.importBatch.update({
    where: { id: statement.importBatchId },
    data: { preview: JSON.parse(JSON.stringify(p.rows.slice(0, 1))) },
  });
  expect(
    (await post(`/statements/${p.id}/retry`, { discardReview: true })).status,
  ).toBe(202);
  await processClaimedStatement((await claimStatement())!);
  const reread = (await statementPreview(p.id)) as StatementPreview;
  expect(reread.rows).toEqual(p.rows);
  expect(await prisma.transaction.count()).toBe(0);
  const body = {
    rows: reread.rows,
    reviewed: true,
    applyOpening: true,
    opening: reread.details.opening,
    schedules: [],
  };
  for (const change of [{ amountCents: 99 }, { date: "2025-12-29" }]) {
    const tampered = structuredClone(body);
    Object.assign(tampered.rows[1]!, change);
    expect((await post(`/statements/${p.id}/commit`, tampered)).status).toBe(
      400,
    );
    expect(await prisma.transaction.count()).toBe(0);
  }
  // This is an explicit review choice: cashback reduces spending as a refund.
  body.rows[1]!.kind = "refund";
  body.rows[1]!.categoryId = null;
  const committed = await post(`/statements/${p.id}/commit`, body);
  expect(committed.status, committed.body.error).toBe(200);
  const saved = await prisma.transaction.findMany({
    where: { accountId: p.accountId },
  });
  expect(saved).toHaveLength(9);
  expect(saved.reduce((sum, row) => sum + Number(row.amountCents), 50000)).toBe(
    60110,
  );
  expect(
    saved.find((row) => row.description.includes("29DEC25")),
  ).toMatchObject({ date: "2025-12-30", kind: "refund", amountCents: 20n });
  expect(
    (await prisma.account.findUniqueOrThrow({ where: { id: p.accountId } }))
      .openingBalanceCents,
  ).toBe(50000n);
  expect((await post(`/statements/${p.id}/commit`, body)).status).toBe(200);
  expect(await prisma.transaction.count()).toBe(9);
});

it("repairs blank-date HSBC credits using the stored group date and rejects a reference date", async () => {
  const p = await preview([
    [
      "HSBC Bank Australia",
      hsbcHeading,
      hsbcRow("01 Jan", "BALANCE BROUGHT FORWARD", "", "", "100.00"),
      hsbcRow("02 Jan", "Grocery", "10.00"),
      hsbcRow("", "01 Jan reference Cashback", "", "0.20", "90.20"),
      hsbcRow("03 Jan", "CLOSING BALANCE", "", "", "90.20"),
    ],
  ]);
  expect(p.rows.every((row) => !row.date && !!row.error)).toBe(true);
  expect(
    (
      await post(`/statements/${p.id}/dates`, {
        corrections: [{ rowNumber: 2, date: "2026-01-01" }],
      })
    ).status,
  ).toBe(400);
  const repaired = await post(`/statements/${p.id}/dates`, {
    corrections: [
      { rowNumber: 1, date: "2026-01-02" },
      { rowNumber: 2, date: "2026-01-02" },
    ],
  });
  expect(repaired.status, repaired.body.error).toBe(200);
  expect(
    (repaired.body as StatementPreview).rows.every(
      (row) => row.date === "2026-01-02" && row.include && !row.error,
    ),
  ).toBe(true);
  expect(((await statementPreview(p.id)) as StatementPreview).rows).toEqual(
    repaired.body.rows,
  );
});
