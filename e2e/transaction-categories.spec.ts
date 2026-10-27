import type { Page } from "@playwright/test";
import { test, expect, session, database, choose } from "./fixtures";

async function seedRows(page: Page) {
  await session(page);
  const db = await database();
  const account = await db.account.create({
    data: {
      name: "Category editing account",
      type: "bank",
      owner: "household",
      openingDate: "2026-01-01",
      openingBalanceCents: 100000n,
    },
  });
  const rows = await Promise.all(
    (["expense", "refund", "income", "transfer"] as const).map((kind) =>
      db.transaction.create({
        data: {
          accountId: account.id,
          owner: "household",
          date: "2026-10-01",
          kind,
          amountCents: kind === "expense" || kind === "transfer" ? -100n : 100n,
          description: "Inline " + kind,
        },
      }),
    ),
  );
  return { db, account, rows };
}

function savedCategory(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith("/transactions/bulk-category") &&
      response.request().method() === "POST",
  );
}

test("inline categories save on both transaction views and respect transaction types", async ({
  page,
}, info) => {
  const { db, account, rows } = await seedRows(page);
  try {
    await page.goto("/transactions?account=" + account.id);
    const expense = page.getByRole("combobox", {
      name: "Category for Inline expense",
    });
    await expense.click();
    await expect(
      page.getByRole("option", { name: "Uncategorised", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Groceries", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Salary", exact: true }),
    ).toHaveCount(0);
    const saved = savedCategory(page);
    await page.getByRole("option", { name: "Groceries", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(expense).toHaveText("Groceries");
    const refundSaved = savedCategory(page);
    await choose(
      page,
      page.getByRole("combobox", { name: "Category for Inline refund" }),
      "Groceries",
    );
    expect((await refundSaved).ok()).toBe(true);
    const income = page.getByRole("combobox", {
      name: "Category for Inline income",
    });
    await income.click();
    await expect(
      page.getByRole("option", { name: "Groceries", exact: true }),
    ).toHaveCount(0);
    const incomeSaved = savedCategory(page);
    await page.getByRole("option", { name: "Salary", exact: true }).click();
    expect((await incomeSaved).ok()).toBe(true);
    await expect(income).toHaveText("Salary");
    await expect(
      page.getByRole("combobox", { name: "Category for Inline transfer" }),
    ).toHaveCount(0);
    await page.goto("/accounts/" + account.id);
    await expect(expense).toHaveText("Groceries");
    const cleared = savedCategory(page);
    await choose(page, expense, "Uncategorised");
    expect((await cleared).ok()).toBe(true);
    await expect(expense).toHaveText("Uncategorised");
    await page.reload();
    await expect(expense).toHaveText("Uncategorised");
    const stored = await db.transaction.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    expect(stored.categoryId).toBeNull();
    expect(stored.version).toBe(3);
    expect(stored.amountCents).toBe(-100n);
    expect(stored.date).toBe("2026-10-01");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/inline-categories-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await db.$disconnect();
  }
});

test("inline category pending state recovers from a stale transaction @timing", async ({
  page,
}) => {
  const { db, account, rows } = await seedRows(page);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.goto("/accounts/" + account.id);
    const expense = page.getByRole("combobox", {
      name: "Category for Inline expense",
    });
    await expect(expense).toHaveText("Uncategorised");
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    // A real competing edit changes the version after the UI's initial snapshot.
    await db.transaction.update({
      where: { id: rows[0].id },
      data: { categoryId: dining.id, version: { increment: 1 } },
    });
    await page.route("**/api/transactions/bulk-category", async (route) => {
      await barrier;
      await route.continue();
    });
    const rejected = savedCategory(page);
    await choose(page, expense, "Groceries");
    await expect(expense).toBeDisabled();
    await expect(
      page.getByRole("status").filter({ hasText: "Saving category…" }),
    ).toBeVisible();
    release();
    expect((await rejected).status()).toBe(409);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "A selected transaction changed" }),
    ).toBeVisible();
    await expect(expense).toBeEnabled();
    await expect(expense).toHaveText("Dining");
    const recovered = savedCategory(page);
    await choose(page, expense, "Groceries");
    expect((await recovered).ok()).toBe(true);
    await expect(expense).toHaveText("Groceries");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "A selected transaction changed" }),
    ).toHaveCount(0);
    expect(
      (await db.transaction.findUniqueOrThrow({ where: { id: rows[0].id } }))
        .version,
    ).toBe(3);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await db.$disconnect();
  }
});

test("transaction searches and optional dates clear without leaving the account", async ({
  page,
}) => {
  const { db, account } = await seedRows(page);
  try {
    await page.goto("/accounts/" + account.id);
    const search = page.getByRole("searchbox", { name: "Search transactions" });
    await search.fill("Inline expense");
    await expect(
      page.getByRole("button", { name: "Select all 1 matching transactions" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Select all 4 matching transactions" }),
    ).toBeVisible();
    await page.getByLabel("From date", { exact: true }).fill("2026-10-02");
    await expect(
      page.getByText("No transactions match.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear from date", exact: true })
      .click();
    await expect(page.getByLabel("From date", { exact: true })).toHaveValue("");
    await page.getByLabel("To date", { exact: true }).fill("2026-09-30");
    await expect(
      page.getByText("No transactions match.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear to date", exact: true })
      .click();
    await expect(page.getByLabel("To date", { exact: true })).toHaveValue("");
    await choose(
      page,
      page.getByRole("combobox", { name: "Filter type" }),
      "Income",
    );
    await expect(
      page.getByRole("button", { name: "Select all 1 matching transactions" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Select all 4 matching transactions" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp("/accounts/" + account.id + "$"));
  } finally {
    await db.$disconnect();
  }
});
