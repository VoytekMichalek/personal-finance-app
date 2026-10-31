import { expect, it, vi } from "vitest";
import { today, addDays } from "@finance/shared";
import { account, post, put } from "./fixtures.js";
import { prisma } from "../lib/db.js";
import { processStatement } from "../modules/statements/process.js";
import { statementPdf } from "./statement-fixture.js";

async function setup() {
  const [from, to, hiddenAccount] = await Promise.all([
    account(),
    account(),
    account(),
  ]);
  await prisma.account.updateMany({ data: { openingDate: "2026-01-01" } });
  const source = await post("/transfers", {
    fromAccountId: from,
    toAccountId: to,
    date: today(),
    description: "NetBank Rent",
    kind: "transfer",
    amountCents: 42500,
  });
  expect(source.status).toBe(201);
  const pair = await prisma.transaction.findMany({
    where: { kind: "transfer" },
  });
  const first = pair.find((r) => r.accountId === from)!;
  const peer = pair.find((r) => r.accountId === to)!;
  const data = {
    accountId: from,
    date: today(),
    description: "NetBank Rent",
    kind: "expense",
    amountCents: -42500n,
  };
  const second = await prisma.transaction.create({
    data: { ...data, amountCents: -43000n, notes: "Keep source" },
  });
  const third = await prisma.transaction.create({
    data: { ...data, amountCents: -44000n },
  });
  const existing = await prisma.transaction.create({
    data: {
      accountId: to,
      date: today(),
      description: "Existing receipt",
      kind: "income",
      amountCents: 43000n,
      notes: "Keep counterpart",
      owner: "household",
    },
  });
  await prisma.receipt.create({
    data: {
      transactionId: existing.id,
      objectKey: "kept",
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      size: 10,
    },
  });
  await prisma.transaction.createMany({
    data: [
      { ...data, date: addDays(today(), -1) },
      { ...data, accountId: hiddenAccount },
      { ...data, amountCents: 42500n, kind: "income" },
    ],
  });
  const rows = [first, second, third];
  const input = {
    source: { id: first.id, version: first.version },
    records: rows.map(({ id, version }) => ({ id, version })),
    filters: { accountId: from, from: today(), to: today(), search: "NetBank" },
    pattern: "netbank rent",
    matchMode: "contains",
    categoryId: null,
    transferChoices: [
      { id: first.id, counterpart: { id: peer.id, version: peer.version } },
      {
        id: second.id,
        counterpart: { id: existing.id, version: existing.version },
      },
      { id: third.id, createCounterpart: true },
    ],
  };
  return { from, to, rows, first, peer, second, third, existing, input };
}
it("remembers transfers within account/date/direction filters, preserves linked metadata and reuses the rule", async () => {
  const { from, to, rows, input, existing } = await setup();
  const result = await post("/transactions/remember", input);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({
    matched: 3,
    changed: 2,
    rule: {
      kind: "transfer",
      accountId: from,
      counterAccountId: to,
      direction: "out",
      categoryId: null,
    },
  });
  expect(await prisma.transaction.count({ where: { kind: "transfer" } })).toBe(
    6,
  );
  for (const row of rows) {
    const after = await prisma.transaction.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(after).toMatchObject({
      kind: "transfer",
      categoryId: null,
      amountCents: row.amountCents,
      date: row.date,
      notes: row.notes,
    });
    const pair = await prisma.transaction.findMany({
      where: { transferGroupId: after.transferGroupId },
    });
    expect(pair).toHaveLength(2);
    expect(pair.reduce((sum, entry) => sum + entry.amountCents, 0n)).toBe(0n);
  }
  expect(
    await prisma.transaction.findUnique({ where: { id: existing.id } }),
  ).toMatchObject({
    notes: "Keep counterpart",
    owner: "household",
    amountCents: 43000n,
  });
  expect(await prisma.receipt.count()).toBe(1);
  expect(
    await prisma.transaction.count({
      where: { kind: { not: "transfer" }, version: 1 },
    }),
  ).toBe(3);
  const refreshed = await prisma.transaction.findMany();
  const version = (id: string) =>
    refreshed.find((row) => row.id === id)!.version;
  const again = {
    ...input,
    source: { id: input.source.id, version: version(input.source.id) },
    records: rows.map((r) => ({ id: r.id, version: version(r.id) })),
    transferChoices: rows.map((r) => {
      const row = refreshed.find((item) => item.id === r.id)!;
      const peer = refreshed.find(
        (item) =>
          item.id !== row.id && item.transferGroupId === row.transferGroupId,
      )!;
      return {
        id: row.id,
        counterpart: { id: peer.id, version: peer.version },
      };
    }),
  };
  expect((await post("/transactions/remember", again)).body.changed).toBe(0);
  expect(await prisma.rule.count()).toBe(1);
});
it.each(["missing", "outside", "stale", "scheduled", "reused"])(
  "rejects %s transfer confirmation atomically",
  async (mode) => {
    const { input, second, third, existing } = await setup();
    if (mode === "missing") input.transferChoices.pop();
    if (mode === "outside") input.filters.from = "2026-01-01";
    if (mode === "stale")
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { version: { increment: 1 } },
      });
    if (mode === "scheduled")
      await prisma.transaction.update({
        where: { id: second.id },
        data: { occurrenceDate: today() },
      });
    if (mode === "reused") {
      await prisma.transaction.update({
        where: { id: third.id },
        data: { amountCents: second.amountCents },
      });
      input.transferChoices[2] = {
        id: third.id,
        counterpart: { id: existing.id, version: existing.version },
      };
    }
    expect((await post("/transactions/remember", input)).status).toBe(409);
    expect(await prisma.rule.count()).toBe(0);
    expect(
      await prisma.transaction.count({ where: { kind: "transfer" } }),
    ).toBe(2);
  },
);
it("rolls back transfer changes when saving the rule fails", async () => {
  const { input } = await setup();
  const original = prisma.$transaction.bind(prisma);
  const spy = vi.spyOn(prisma, "$transaction");
  spy.mockImplementationOnce(((
    callback: (tx: typeof prisma) => Promise<unknown>,
    options: object,
  ) =>
    original(async (tx) => {
      const wrapped = Object.create(tx);
      wrapped.rule = {
        ...tx.rule,
        create: () => {
          throw new Error("Synthetic rule failure");
        },
      };
      return callback(wrapped);
    }, options)) as typeof prisma.$transaction);
  try {
    expect((await post("/transactions/remember", input)).status).toBe(500);
  } finally {
    spy.mockRestore();
  }
  expect(await prisma.transaction.count({ where: { kind: "transfer" } })).toBe(
    2,
  );
  expect(await prisma.rule.count()).toBe(0);
});
it.each(["CSV", "PDF"])(
  "uses saved transfer rules in future %s review, and honours pausing",
  async (format) => {
    const { input, from, to } = await setup();
    const remembered = await post("/transactions/remember", input);
    expect(remembered.status).toBe(200);
    const preview = async () => {
      if (format === "PDF")
        return (
          await processStatement(
            from,
            statementPdf([
              [
                "Statement 2026",
                "Opening balance 1000.00",
                `${today()} NetBank Rent -10.00`,
                "Closing balance 990.00",
              ],
            ]),
            {},
            async () => {},
          )
        ).rows;
      const csv = `Date,Description,Amount\n${today()},NetBank Rent,-10.00`;
      const header = await post("/imports/headers", { csv, accountId: from });
      const result = await post("/imports/preview", {
        csv,
        accountId: from,
        mapping: header.body.mapping,
      });
      expect(result.status).toBe(200);
      return result.body.rows;
    };
    expect(await preview()).toMatchObject([
      {
        kind: "transfer",
        counterAccountId: to,
        categoryId: null,
        categorySource: "rule",
      },
    ]);
    expect(
      (
        await put("/rules/" + remembered.body.rule.id, {
          ...remembered.body.rule,
          enabled: false,
        })
      ).status,
    ).toBe(200);
    expect(await preview()).toMatchObject([
      { kind: "expense", counterAccountId: null },
    ]);
    expect(
      (
        await put("/rules/" + remembered.body.rule.id, {
          ...remembered.body.rule,
          counterAccountId: from,
        })
      ).status,
    ).toBe(400);
  },
);

it("remembers incoming transfers without changing their money direction", async () => {
  const { from, to, first, peer, input } = await setup();
  const incoming = await prisma.transaction.create({
    data: {
      accountId: to,
      date: today(),
      description: "NetBank Rent",
      kind: "income",
      amountCents: 45000n,
    },
  });
  const result = await post("/transactions/remember", {
    ...input,
    source: { id: peer.id, version: peer.version },
    filters: { accountId: to, from: today(), to: today() },
    records: [peer, incoming].map(({ id, version }) => ({ id, version })),
    transferChoices: [
      { id: peer.id, counterpart: { id: first.id, version: first.version } },
      { id: incoming.id, createCounterpart: true },
    ],
  });
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({
    matched: 2,
    changed: 1,
    rule: { accountId: to, counterAccountId: from, direction: "in" },
  });
  const after = await prisma.transaction.findUniqueOrThrow({
    where: { id: incoming.id },
  });
  expect(after).toMatchObject({ kind: "transfer", amountCents: 45000n });
  const pair = await prisma.transaction.findMany({
    where: { transferGroupId: after.transferGroupId },
  });
  expect(pair).toHaveLength(2);
  expect(pair.reduce((sum, row) => sum + row.amountCents, 0n)).toBe(0n);
});
