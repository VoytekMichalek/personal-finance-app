import { test, expect, session, database, choose } from "./fixtures";

test("account filters select every matching page and preserve hidden transactions", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "Selection account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Other account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    await db.transaction.createMany({
      data: Array.from({ length: 61 }, (_, index) => ({
        accountId: account.id,
        date: "2026-10-01",
        kind: index === 60 ? "transfer" : "expense",
        amountCents: -100n,
        owner: "household",
        description: (index < 55 ? "Matching " : "Hidden ") + index,
      })),
    });
    await db.transaction.create({
      data: {
        accountId: other.id,
        date: "2026-10-01",
        kind: "expense",
        amountCents: -999n,
        owner: "household",
        description: "Matching other account",
      },
    });
    await page.goto("/accounts/" + account.id);
    await page
      .getByRole("button", { name: "Select all 61 matching transactions" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "61 selected" }),
    ).toBeVisible();
    await expect(
      page.getByText("60 can be categorised; 1 transfers", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("51–61 of 61")).toBeVisible();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(12);
    await choose(page, page.getByLabel("Bulk category"), "Groceries");
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/transactions/bulk-category") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Apply category" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(
      page.getByRole("status").filter({ hasText: "0 selected" }),
    ).toBeVisible();
    const groceries = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    expect(
      await db.transaction.count({ where: { categoryId: groceries.id } }),
    ).toBe(60);
    await page
      .getByRole("button", { name: "Select all 61 matching transactions" })
      .click();
    await page.getByLabel("Search transactions").fill("Matching");
    await expect(
      page.getByRole("status").filter({ hasText: "0 selected" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Select all 55 matching transactions" })
      .click();
    await choose(page, page.getByLabel("Bulk category"), "Dining");
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/transactions/bulk-category") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Apply category" }).click();
    expect((await updated).ok()).toBe(true);
    await expect(
      page.getByRole("status").filter({ hasText: "0 selected" }),
    ).toBeVisible();
    expect(
      await db.transaction.count({ where: { categoryId: groceries.id } }),
    ).toBe(5);
    expect(
      (
        await db.transaction.findFirstOrThrow({
          where: { accountId: other.id },
        })
      ).categoryId,
    ).toBeNull();
    await page.goto("/transactions?account=" + account.id);
    await expect(
      page.getByRole("button", { name: "Select all 61 matching transactions" }),
    ).toBeVisible();
    await choose(page, page.getByLabel("Filter category"), "Groceries");
    await expect(
      page.getByRole("button", { name: "Select all 5 matching transactions" }),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});

test("account balance history and category drill-down reconcile with refunds and transfers", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "History account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const groceries = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    await db.transaction.createMany({
      data: [
        {
          kind: "expense",
          description: "Food purchase",
          amountCents: -10000n,
          categoryId: groceries.id,
        },
        {
          kind: "refund",
          description: "Food refund",
          amountCents: 2000n,
          categoryId: groceries.id,
        },
        {
          kind: "expense",
          description: "Cafe purchase",
          amountCents: -500n,
          categoryId: dining.id,
        },
        {
          kind: "income",
          description: "Salary",
          amountCents: 20000n,
          categoryId: null,
        },
        {
          kind: "transfer",
          description: "Moved funds",
          amountCents: -30000n,
          categoryId: null,
        },
      ].map((row) => ({
        ...row,
        accountId: account.id,
        owner: "household",
        date: "2026-01-02",
      })),
    });
    await page.goto("/accounts/" + account.id + "?tab=insights");
    await expect(
      page.getByRole("tab", { name: "Balance & spending" }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("History to").fill("2026-01-03");
    await expect(
      page.getByRole("img", { name: "History account historical balance" }),
    ).toBeVisible();
    await expect(
      page.getByText("Closing balance", { exact: true }).locator(".."),
    ).toContainText("$815.00");
    await expect(
      page.getByText("Money in", { exact: true }).locator(".."),
    ).toContainText("$220.00");
    await expect(
      page.getByText("Money out", { exact: true }).locator(".."),
    ).toContainText("$405.00");
    await expect(
      page.getByText("$85.00 net expenses", { exact: false }),
    ).toBeVisible();
    await page.getByText("View balance values", { exact: true }).click();
    await expect(
      page
        .getByRole("table", { name: "Daily closing balances" })
        .getByRole("row"),
    ).toHaveCount(4);
    await page.screenshot({
      path: `artifacts/account-insights-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const categoryButton = page.getByRole("button", {
      name: "Groceries: $80.00, 2 transactions",
      exact: true,
    });
    const groceryColour = await categoryButton
      .locator("span[style]")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const diningColour = await page
      .getByRole("button", {
        name: "Dining: $5.00, 1 transactions",
        exact: true,
      })
      .locator("span[style]")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(groceryColour).not.toBe(diningColour);
    await categoryButton.click();
    const detail = page.getByRole("dialog", { name: "Groceries" });
    await expect(
      detail.getByText("Food purchase", { exact: true }),
    ).toBeVisible();
    await expect(
      detail.getByText("Food refund", { exact: true }),
    ).toBeVisible();
    await expect(detail.getByText("Transactions · 2")).toBeVisible();
    await expect(
      detail.getByRole("img", { name: "Groceries spending trend" }),
    ).toBeVisible();
    await detail
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByLabel("History from").fill("2026-01-03");
    await expect(
      page.getByText("Balance before period", { exact: true }).locator(".."),
    ).toContainText("$815.00");
    await expect(
      page.getByText("No spending recorded in this period."),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
