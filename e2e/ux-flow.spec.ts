import { randomUUID } from "node:crypto";
import { test, expect, choose, tickFilter } from "./fixtures";
import { seed, day, month } from "./ux-fixtures";
test("overview drill-downs preserve month and owner, and transactions keep filters, pages and Back position", async ({
  page,
}, info) => {
  const { db, owner, accounts } = await seed(page);
  try {
    await page.goto("/");
    await choose(
      page,
      page.getByRole("combobox", { name: "Ownership filter" }),
      "Voytek",
    );
    await page.getByRole("button", { name: /^Money out/ }).click();
    await expect(page).toHaveURL(new RegExp(`owner=${owner}`));
    await expect(page).toHaveURL(new RegExp(`from=${month}-01`));
    await expect(
      page.getByRole("button", {
        name: "Select all 65 matching transactions",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/page=1/);
    const purchase = page
      .locator("tbody tr")
      .first()
      .getByRole("button", { name: /Flow purchase/ })
      .first();
    await expect(page.locator("tbody tr")).toHaveCount(15);
    await expect(purchase).toBeVisible();
    await purchase.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await purchase.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/page=1/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Select all 65 matching transactions",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/page=1/);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await tickFilter(page, "Filter account", [
      accounts[0].name,
      accounts[1].name,
    ]);
    await tickFilter(page, "Filter category", ["Groceries", "Dining"]);
    await expect(
      page.getByRole("button", {
        name: "Select all 65 matching transactions",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Other owner purchase", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ux-transactions-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`/accounts/${accounts[0].id}`);
    await expect(
      page.getByText("Current balance", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Import transactions", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "PDF statement", exact: true }),
    ).toHaveAttribute("href", `/accounts/${accounts[0].id}/statement`);
    await expect(
      page.getByRole("link", { name: "CSV export", exact: true }),
    ).toHaveAttribute("href", `/imports?account=${accounts[0].id}`);
  } finally {
    await db.$disconnect();
  }
});

test("budgets edit in place, spent links keep the month, and rules and settings have clear destinations", async ({
  page,
}, info) => {
  const { db, food, accounts } = await seed(page);
  try {
    await db.budget.create({
      data: { categoryId: food.id, month, amountCents: 50000n },
    });
    await db.rule.createMany({
      data: [
        {
          pattern: "Flow purchase",
          categoryId: food.id,
          enabled: true,
          priority: 100,
        },
        {
          pattern: "Paused merchant",
          categoryId: food.id,
          enabled: false,
          priority: 200,
        },
      ],
    });
    await page.goto("/plan");
    await page
      .getByRole("button", { name: "Edit Groceries budget", exact: true })
      .click();
    await page
      .getByLabel("Groceries budget amount", { exact: true })
      .fill("600");
    const saved = page.waitForResponse(
      (r) => r.url().endsWith("/api/budgets") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Edit Groceries budget", exact: true }),
    ).toContainText("$600.00");
    await page
      .getByRole("button", { name: "Edit Groceries budget", exact: true })
      .click();
    await page
      .getByLabel("Groceries budget amount", { exact: true })
      .fill("999");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByLabel("Groceries budget amount", { exact: true }),
    ).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Edit Groceries budget", exact: true }),
    ).toContainText("$600.00");
    expect(
      (
        await db.budget.findFirstOrThrow({
          where: { categoryId: food.id, month },
        })
      ).amountCents,
    ).toBe(60000n);
    await page.getByRole("link", { name: /\$32\.00/ }).click();
    await expect(page).toHaveURL(new RegExp(`category=${food.id}`));
    await expect(page).toHaveURL(new RegExp(`from=${month}-01`));
    await expect(
      page.getByRole("button", {
        name: "Select all 32 matching transactions",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/categories");
    await page.getByRole("tab", { name: "Rules", exact: true }).click();
    await choose(
      page,
      page.getByRole("combobox", { name: "Rule status" }),
      "Paused",
    );
    await expect(
      page.getByRole("button", { name: /Contains “Paused merchant”/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Contains “Flow purchase”/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: /Contains “Paused merchant”/ })
      .click();
    await expect(
      page.getByLabel("Priority", { exact: true }),
    ).not.toBeVisible();
    await page.getByText("Advanced", { exact: true }).click();
    await expect(page.getByLabel("Priority", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto("/settings");
    for (const name of ["People", "AI", "Release notes", "System details"])
      await expect(
        page.getByRole("link", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    await page.screenshot({
      path: `artifacts/ux-settings-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`/accounts/${accounts[0].id}`);
    await page
      .getByRole("button", { name: "Edit account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeInViewport();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});

test("assets explain valuations and transfers, net worth groups totals and switches ranges, and Plan separates upcoming from recurring", async ({
  page,
}, info) => {
  const { db, owner, accounts } = await seed(page);
  try {
    const asset = await db.asset.create({
      data: {
        name: "Share portfolio",
        kind: "asset",
        classification: "investment",
        owner,
        valuations: { create: { date: "2026-01-01", amountCents: 100000n } },
      },
    });
    const assetAccount = await db.account.create({
      data: {
        name: asset.name,
        type: "asset",
        assetId: asset.id,
        owner,
        openingDate: "2025-01-01",
        openingBalanceCents: 0n,
      },
    });
    const group = randomUUID();
    await db.transaction.createMany({
      data: [
        {
          accountId: accounts[0].id,
          owner,
          date: day,
          kind: "transfer",
          description: "Share contribution",
          amountCents: -50000n,
          transferGroupId: group,
        },
        {
          accountId: assetAccount.id,
          owner,
          date: day,
          kind: "transfer",
          description: "Share contribution",
          amountCents: 50000n,
          transferGroupId: group,
        },
      ],
    });
    await db.asset.create({
      data: {
        name: "Home loan",
        kind: "liability",
        classification: "loan",
        owner: "household",
        valuations: { create: { date: "2026-01-01", amountCents: 200000n } },
      },
    });
    await db.schedule.create({
      data: {
        name: "Internet",
        accountId: accounts[0].id,
        owner,
        kind: "expense",
        amountCents: 7900n,
        startDate: day,
        frequency: "monthly",
        subscription: true,
      },
    });
    await page.goto("/assets");
    await expect(
      page.getByRole("heading", { name: "Assets", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Liabilities", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/ux-asset-groups-${info.project.name}.png`,
      animations: "disabled",
    });
    await page.getByRole("link", { name: /Share portfolio/ }).click();
    await expect(
      page.getByText(
        /Last recorded value \$1,000.00 \+ subsequent transfers \$500.00 = current value \$1,500.00/,
      ),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Valuations", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Past valuations", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/ux-asset-${info.project.name}.png`,
      animations: "disabled",
    });
    await page.goto("/net-worth");
    await expect(
      page.getByRole("region", { name: "Investments", exact: true }),
    ).toContainText("$1,500.00");
    await expect(
      page.getByRole("region", { name: "Debts", exact: true }),
    ).toContainText("-$2,000.00");
    await page.getByRole("button", { name: "1 month", exact: true }).click();
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    await expect(page.getByRole("table")).toContainText("Date");
    await expect(page).toHaveURL(/period=30/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ux-net-worth-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto("/plan?tab=bills");
    await expect(
      page.getByRole("heading", { name: "This week", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record payment", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Recurring items", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit Internet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Upcoming payments", exact: true }),
    ).toHaveCount(0);
  } finally {
    await db.$disconnect();
  }
});
