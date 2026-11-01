import { randomUUID } from "node:crypto";
import { test, expect, session, database, choose } from "./fixtures";

for (const view of ["all transactions", "account transactions"]) {
  test(`Uncategorised excludes transfers and updates after conversion in ${view}`, async ({
    page,
  }) => {
    await session(page);
    const db = await database();
    try {
      const accounts = await Promise.all(
        ["Bank", "Savings"].map((name) =>
          db.account.create({
            data: {
              name,
              type: "bank",
              owner: "household",
              openingDate: "2026-01-01",
              openingBalanceCents: 100000n,
            },
          }),
        ),
      );
      const category = await db.category.findFirstOrThrow({
        where: { name: "Dining" },
      });
      const base = {
        accountId: accounts[0].id,
        owner: "household",
        date: "2026-10-01",
      };
      const expense = await db.transaction.create({
        data: {
          ...base,
          kind: "expense",
          amountCents: -100n,
          description: "Unclassified payment",
          notes: "Keep these details",
        },
      });
      const transferGroupId = randomUUID();
      await db.transaction.createMany({
        data: [
          {
            ...base,
            kind: "income",
            amountCents: 100n,
            description: "Unclassified income",
          },
          {
            ...base,
            kind: "refund",
            amountCents: 100n,
            description: "Unclassified refund",
          },
          {
            ...base,
            kind: "expense",
            amountCents: -200n,
            description: "Categorised dinner",
            categoryId: category.id,
          },
          {
            ...base,
            kind: "transfer",
            amountCents: -300n,
            description: "Transfer out",
            transferGroupId,
          },
          {
            ...base,
            accountId: accounts[1].id,
            kind: "transfer",
            amountCents: 300n,
            description: "Transfer in",
            transferGroupId,
          },
        ],
      });
      await page.goto(
        view === "all transactions"
          ? "/transactions"
          : `/accounts/${accounts[0].id}`,
      );
      const categoryFilter = page.getByLabel("Filter category", {
        exact: true,
      });
      const count = (n: number) =>
        page.getByRole("button", {
          name: `Select all ${n} matching transactions`,
          exact: true,
        });
      await choose(page, categoryFilter, "Uncategorised");
      await expect(count(3)).toBeVisible();
      for (const description of [
        "Unclassified payment",
        "Unclassified income",
        "Unclassified refund",
      ])
        await expect(
          page.getByText(description, { exact: true }),
        ).toBeVisible();
      for (const description of [
        "Transfer out",
        "Transfer in",
        "Categorised dinner",
      ])
        await expect(page.getByText(description, { exact: true })).toHaveCount(
          0,
        );
      await count(3).click();
      await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "Clear selection", exact: true })
        .click();
      await choose(
        page,
        page.getByLabel("Filter type", { exact: true }),
        "Transfers",
      );
      await expect(page.getByText(/No transactions match\./)).toBeVisible();
      await choose(page, categoryFilter, "All categories");
      await expect(count(view === "all transactions" ? 2 : 1)).toBeVisible();
      await expect(
        page.getByText("Transfer out", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      await choose(page, categoryFilter, "Uncategorised");
      await expect(count(3)).toBeVisible();
      await choose(
        page,
        page.getByRole("combobox", {
          name: "Type for Unclassified payment",
          exact: true,
        }),
        "Transfer",
      );
      await choose(
        page,
        page.getByLabel("Other account for Unclassified payment", {
          exact: true,
        }),
        "Savings",
      );
      const saved = page.waitForResponse(
        (r) => r.url().endsWith("/type") && r.request().method() === "PUT",
      );
      await page
        .getByRole("button", { name: "Save type", exact: true })
        .click();
      expect((await saved).ok()).toBe(true);
      await expect(count(2)).toBeVisible();
      await expect(
        page.getByText("Unclassified payment", { exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await choose(page, categoryFilter, "Uncategorised");
      await expect(count(2)).toBeVisible();
      const stored = await db.transaction.findUniqueOrThrow({
        where: { id: expense.id },
      });
      expect(stored).toMatchObject({
        kind: "transfer",
        categoryId: null,
        amountCents: -100n,
        date: expense.date,
        notes: expense.notes,
      });
      const pair = await db.transaction.findMany({
        where: { transferGroupId: stored.transferGroupId },
      });
      expect(pair).toHaveLength(2);
      expect(pair.reduce((total, row) => total + row.amountCents, 0n)).toBe(0n);
      expect(await db.transaction.count()).toBe(7);
    } finally {
      await db.$disconnect();
    }
  });
}
