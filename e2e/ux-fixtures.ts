import { randomUUID } from "node:crypto";
import { session, database } from "./fixtures";
import { today } from "../packages/shared/src/index";
export const day = today(),
  month = day.slice(0, 7);
export async function seed(page: Parameters<typeof session>[0]) {
  const owner = await session(page),
    db = await database();
  const person = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Nicola",
      email: "nicola-flow@example.test",
      role: "member",
      state: "invited",
    },
  });
  const accounts = await Promise.all(
    ["Everyday", "Savings", "Excluded account"].map((name, i) =>
      db.account.create({
        data: {
          name,
          type: "bank",
          owner: i === 2 ? person.id : owner,
          openingDate: "2025-01-01",
          openingBalanceCents: 1000000n,
        },
      }),
    ),
  );
  const food = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    }),
    dining = await db.category.findFirstOrThrow({ where: { name: "Dining" } });
  await db.transaction.createMany({
    data: Array.from({ length: 65 }, (_, i) => ({
      accountId: accounts[i % 2].id,
      owner,
      date: day,
      kind: "expense",
      description: `Flow purchase ${String(i).padStart(3, "0")}`,
      amountCents: -100n,
      categoryId: i % 2 ? food.id : dining.id,
    })),
  });
  await db.transaction.createMany({
    data: [
      {
        accountId: accounts[0].id,
        owner,
        date: "2025-01-01",
        kind: "expense",
        description: "Old purchase",
        amountCents: -200n,
      },
      {
        accountId: accounts[2].id,
        owner: person.id,
        date: day,
        kind: "expense",
        description: "Other owner purchase",
        amountCents: -200n,
      },
      {
        accountId: accounts[0].id,
        owner,
        date: day,
        kind: "transfer",
        description: "Transfer excluded from spending",
        amountCents: -200n,
      },
    ],
  });
  return { db, owner, person, accounts, food, dining };
}
