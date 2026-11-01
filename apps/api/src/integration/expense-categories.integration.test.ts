import "./fixtures.js";
import { expect, it } from "vitest";
import { prisma, json } from "../lib/db.js";
import { account, memberId, post } from "./fixtures.js";
import {
  expenseReport,
  type Category,
  type Transaction,
} from "@finance/shared";

it("remembers precisely the expense report's month, multi-account, owner, parent category, search and drill-down intersection", async () => {
  const [bank, card, hidden] = await Promise.all([
    account(),
    account(),
    account(),
  ]);
  const parent = await prisma.category.create({
    data: { name: "Shopping", kind: "expense", color: "#123456" },
  });
  const child = await prisma.category.create({
    data: {
      name: "Child shop",
      kind: "expense",
      parentId: parent.id,
      color: "#123456",
    },
  });
  const target = await prisma.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const base = {
    accountId: bank,
    date: "2026-10-01",
    description: "Local Shop",
    kind: "expense",
    amountCents: -1000n,
    categoryId: child.id,
    owner: memberId,
  };
  await prisma.transaction.createMany({
    data: [
      base,
      { ...base, accountId: card },
      {
        ...base,
        accountId: card,
        owner: "household",
        kind: "refund",
        amountCents: 200n,
      },
      { ...base, accountId: hidden },
      { ...base, date: "2026-09-30" },
      { ...base, categoryId: parent.id },
      { ...base, categoryId: null },
      { ...base, description: "Different shop" },
      { ...base, kind: "income", amountCents: 1000n },
      { ...base, kind: "transfer" },
    ],
  });
  const rows = json<Transaction[]>(await prisma.transaction.findMany());
  const filters = {
    from: "2026-10-01",
    to: "2026-10-31",
    accountIds: [bank, card],
    owners: [memberId, "household"],
    categoryIds: [parent.id],
    search: "local",
    detail: { group: "categories" as const, id: child.id },
  };
  const selected = expenseReport(
    {
      transactions: rows,
      categories: json<Category[]>(await prisma.category.findMany()),
    },
    filters,
  ).rows;
  expect(selected).toHaveLength(3);
  const body = {
    source: { id: selected[0]!.id, version: 1 },
    records: selected.map(({ id, version }) => ({ id, version })),
    categoryId: target.id,
    pattern: "Local Shop",
    matchMode: "exact",
    filters: { expenses: filters },
  };
  const excluded = rows.find((row) => row.accountId === hidden)!;
  expect(
    (
      await post("/transactions/remember", {
        ...body,
        records: [...body.records, { id: excluded.id, version: 1 }],
      })
    ).status,
  ).toBe(409);
  expect(await prisma.rule.count()).toBe(0);
  const response = await post("/transactions/remember", body);
  expect(response.status, response.body.error).toBe(200);
  expect(response.body).toMatchObject({ matched: 3, changed: 3 });
  for (const row of await prisma.transaction.findMany()) {
    const changed = selected.some((item) => item.id === row.id);
    expect(row.version).toBe(changed ? 2 : 1);
    expect(row.categoryId).toBe(
      changed ? target.id : rows.find((item) => item.id === row.id)!.categoryId,
    );
  }
  expect(await prisma.rule.findFirst()).toMatchObject({
    categoryId: target.id,
    enabled: true,
  });
});
