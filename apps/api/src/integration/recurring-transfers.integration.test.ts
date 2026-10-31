import "./fixtures.js";
import { expect, it } from "vitest";
import request from "supertest";
import { addDays, today, type StatementPreview } from "@finance/shared";
import { account, memberCookie, origin, post, put } from "./fixtures.js";
import { prisma } from "../lib/db.js";
import { app } from "../app.js";
import { statementPdf, sixMonthStatement } from "./statement-fixture.js";
import {
  claimStatement,
  processClaimedStatement,
} from "../modules/statements/worker.js";
import { statementPreview } from "../modules/statements/service.js";
async function accounts() {
  const from = await account(),
    to = await account();
  await prisma.account.updateMany({ data: { openingDate: "2026-01-01" } });
  return { from, to };
}
async function statement(accountId: string) {
  const uploaded = await request(app)
    .post("/api/statements")
    .set("Origin", origin)
    .set("Cookie", memberCookie)
    .field("accountId", accountId)
    .attach("file", statementPdf(sixMonthStatement()), "recurring.pdf");
  expect(uploaded.status).toBe(202);
  const job = await claimStatement();
  expect(job?.id).toBe(uploaded.body.id);
  await processClaimedStatement(job!);
  return (await statementPreview(job!.id)) as StatementPreview;
}
it("saves incoming and outgoing transfer suggestions with correct account direction, preserving existing opening balances and ledger", async () => {
  const { from, to } = await accounts();
  const p = await statement(to);
  const suggestions = p.details.recurring.map((item) => ({
    key: item.key,
    schedule: {
      ...item.schedule,
      kind: "transfer",
      accountId: item.schedule.kind === "income" ? from : to,
      counterAccountId: item.schedule.kind === "income" ? to : from,
      categoryId: null,
      subscription: false,
    },
  }));
  const result = await post(`/statements/${p.id}/commit`, {
    rows: p.rows,
    reviewed: true,
    applyOpening: true,
    opening: { date: "2025-12-01", amountCents: 100000 },
    schedules: suggestions,
  });
  expect(result.status, result.body.error).toBe(200);
  expect(
    await prisma.account.findUniqueOrThrow({ where: { id: to } }),
  ).toMatchObject({ openingDate: "2026-01-01", openingBalanceCents: 100000n });
  expect(await prisma.schedule.findMany()).toHaveLength(2);
  for (const item of suggestions)
    expect(
      await prisma.schedule.findFirst({ where: { name: item.schedule.name } }),
    ).toMatchObject({
      kind: "transfer",
      accountId: item.schedule.accountId,
      counterAccountId: item.schedule.counterAccountId,
      categoryId: null,
      subscription: false,
    });
  expect(await prisma.transaction.count()).toBe(12);
  const more = await request(app)
    .get(`/api/statements/${p.id}/recurring`)
    .set("Cookie", memberCookie);
  expect(more.body).toEqual([]);
});
it("allows transfer conversion after import, rejects missing or wrong-direction accounts and retains posted evidence", async () => {
  const { from, to } = await accounts();
  const p = await statement(to);
  expect(
    (
      await post(`/statements/${p.id}/commit`, {
        rows: p.rows,
        reviewed: true,
        applyOpening: false,
        opening: null,
        schedules: [],
      })
    ).status,
  ).toBe(200);
  const ledger = await prisma.transaction.findMany({ orderBy: { id: "asc" } });
  const candidate = p.details.recurring.find(
    (item) => item.schedule.kind === "income",
  )!;
  const schedule = {
    ...candidate.schedule,
    kind: "transfer",
    accountId: from,
    counterAccountId: to,
    categoryId: null,
    subscription: false,
  };
  for (const invalid of [
    { ...schedule, counterAccountId: null },
    { ...schedule, accountId: to },
    { ...schedule, accountId: to, counterAccountId: from },
  ]) {
    expect(
      (
        await post(`/statements/${p.id}/recurring`, {
          reviewed: true,
          schedules: [{ key: candidate.key, schedule: invalid }],
        })
      ).status,
    ).toBe(400);
    expect(await prisma.schedule.count()).toBe(0);
  }
  expect(
    (
      await post(`/statements/${p.id}/recurring`, {
        reviewed: true,
        schedules: [{ key: candidate.key, schedule }],
      })
    ).status,
  ).toBe(200);
  expect(await prisma.transaction.findMany({ orderBy: { id: "asc" } })).toEqual(
    ledger,
  );
});
it("preserves opening balance when another payment arrived after the statement review opened", async () => {
  const { from, to } = await accounts();
  await prisma.account.update({
    where: { id: to },
    data: { openingBalanceCents: 0n },
  });
  const p = await statement(to);
  await post("/transfers", {
    fromAccountId: from,
    toAccountId: to,
    date: today(),
    amountCents: 1234,
  });
  const result = await post(`/statements/${p.id}/commit`, {
    rows: p.rows,
    reviewed: true,
    applyOpening: true,
    opening: p.details.opening,
    schedules: [],
  });
  expect(result.status, result.body.error).toBe(200);
  expect(
    await prisma.account.findUniqueOrThrow({ where: { id: to } }),
  ).toMatchObject({ openingDate: "2026-01-01", openingBalanceCents: 0n });
  expect(await prisma.transaction.count()).toBe(14);
});
it("records both sides of a recurring transfer once under concurrency and refuses invalid schedule accounts", async () => {
  const { from, to } = await accounts();
  const body = {
    name: "Regular savings",
    accountId: from,
    counterAccountId: to,
    kind: "transfer",
    amountCents: 2500,
    startDate: today(),
    frequency: "monthly",
  };
  for (const invalid of [
    { ...body, counterAccountId: from },
    { ...body, counterAccountId: null },
    { ...body, subscription: true },
  ])
    expect((await post("/schedules", invalid)).status).toBe(400);
  const saved = await post("/schedules", body);
  expect(saved.status, saved.body.error).toBe(200);
  const results = await Promise.all([
    post(`/schedules/${saved.body.id}/match`, { date: today() }),
    post(`/schedules/${saved.body.id}/match`, { date: today() }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const entries = await prisma.transaction.findMany();
  expect(entries).toHaveLength(2);
  expect(entries.reduce((sum, row) => sum + row.amountCents, 0n)).toBe(0n);
  expect(entries.filter((row) => row.scheduleId)).toHaveLength(1);
  expect(entries.find((row) => row.scheduleId)).toMatchObject({
    accountId: from,
    amountCents: -2500n,
    occurrenceDate: today(),
  });
  await prisma.account.update({ where: { id: to }, data: { archived: true } });
  expect(
    (await put(`/schedules/${saved.body.id}`, { ...body, name: "Changed" }))
      .status,
  ).toBe(409);
});
it("matches only a complete unclaimed transfer with the scheduled accounts, without duplicating either entry", async () => {
  const { from, to } = await accounts();
  const saved = await post("/schedules", {
    name: "Move money",
    accountId: from,
    counterAccountId: to,
    kind: "transfer",
    amountCents: 1500,
    startDate: today(),
    frequency: "monthly",
  });
  await post("/transfers", {
    fromAccountId: from,
    toAccountId: to,
    date: today(),
    amountCents: 1500,
  });
  const source = await prisma.transaction.findFirstOrThrow({
    where: { accountId: from },
  });
  const other = await prisma.transaction.findFirstOrThrow({
    where: { accountId: to },
  });
  expect(
    (
      await post(`/schedules/${saved.body.id}/match`, {
        date: today(),
        transactionId: other.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post(`/schedules/${saved.body.id}/match`, {
        date: addDays(today(), 1),
        transactionId: source.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post(`/schedules/${saved.body.id}/match`, {
        date: today(),
        transactionId: source.id,
      })
    ).status,
  ).toBe(200);
  expect(await prisma.transaction.count()).toBe(2);
  expect(
    await prisma.transaction.findUnique({ where: { id: other.id } }),
  ).toEqual(other);
});

it("derives recurring transfer suggestions from posted balanced pairs and saves them without new transactions", async () => {
  const { from, to } = await accounts();
  const p = await statement(to);
  const rows = p.rows.map((row) => ({
    ...row,
    kind: "transfer",
    counterAccountId: from,
    categoryId: null,
  }));
  const imported = await post(`/statements/${p.id}/commit`, {
    rows,
    reviewed: true,
    applyOpening: false,
    opening: null,
    schedules: [],
  });
  expect(imported.status, imported.body.error).toBe(200);
  const ledger = await prisma.transaction.findMany({ orderBy: { id: "asc" } });
  expect(ledger).toHaveLength(24);
  const suggestions = await request(app)
    .get(`/api/statements/${p.id}/recurring`)
    .set("Cookie", memberCookie);
  expect(suggestions.status).toBe(200);
  expect(suggestions.body).toHaveLength(2);
  expect(
    suggestions.body
      .map(
        (item: {
          schedule: {
            accountId: string;
            counterAccountId: string;
            kind: string;
          };
        }) => [
          item.schedule.kind,
          item.schedule.accountId,
          item.schedule.counterAccountId,
        ],
      )
      .sort(),
  ).toEqual(
    [
      ["transfer", from, to],
      ["transfer", to, from],
    ].sort(),
  );
  const saved = await post(`/statements/${p.id}/recurring`, {
    reviewed: true,
    schedules: suggestions.body,
  });
  expect(saved.status, saved.body.error).toBe(200);
  expect(await prisma.transaction.findMany({ orderBy: { id: "asc" } })).toEqual(
    ledger,
  );
});
