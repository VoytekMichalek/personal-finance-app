import { test, expect, choose } from "./fixtures";
import { seed, day, month } from "./ux-fixtures";

test("dashboard calendar-year shortcuts keep balances current and drill down to the chosen period", async ({
  page,
}, info) => {
  const { db, accounts, owner } = await seed(page);
  try {
    await db.account.update({
      where: { id: accounts[0].id },
      data: { institution: "CBA", institutionPreset: "cba" },
    });
    await db.transaction.createMany({
      data: [
        {
          accountId: accounts[0].id,
          owner,
          date: day.slice(0, 4) + "-01-01",
          kind: "income",
          description: "Annual salary",
          amountCents: 500000n,
        },
        {
          accountId: accounts[0].id,
          owner,
          date: day.slice(0, 4) + "-01-01",
          kind: "expense",
          description: "January expense",
          amountCents: -10000n,
        },
        {
          accountId: accounts[0].id,
          owner,
          date: day.slice(0, 4) + "-01-01",
          kind: "refund",
          description: "January refund",
          amountCents: 2500n,
        },
      ],
    });
    await page.goto("/");
    await choose(
      page,
      page.getByRole("combobox", { name: "Ownership filter" }),
      "Voytek",
    );
    await expect(
      page.getByRole("button", { name: /^Available balance/ }),
    ).toContainText("$24,856.00");
    const balance = await page
      .getByRole("button", { name: /^Available balance/ })
      .innerText();
    await page.getByRole("button", { name: "This year", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "This year", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: /^Money out/ }),
    ).toContainText("$140.00");
    await expect(page.getByRole("button", { name: /^Money in/ })).toContainText(
      "$5,000.00",
    );
    await expect(
      page.getByRole("button", { name: /^Net income/ }),
    ).toContainText("$4,860.00");
    await expect(
      page.getByRole("button", { name: /^Available balance/ }),
    ).toHaveText(balance, { useInnerText: true });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "This year", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/visual-overview-${info.project.name}.png`,
      scale: "css",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("link", { name: "All categories", exact: true })
      .click();
    expect(new URL(page.url()).searchParams.get("from")).toBe(
      day.slice(0, 4) + "-01-01",
    );
    expect(new URL(page.url()).searchParams.get("to")).toBe(day);
    await page.goBack();
    await page.getByRole("button", { name: /^Net income/ }).click();
    expect(new URL(page.url()).searchParams.getAll("kind")).toEqual([
      "income",
      "expense",
      "refund",
    ]);
    await page
      .getByRole("searchbox", { name: "Search transactions" })
      .fill("Annual salary");
    await expect(
      page.getByText("Annual salary", { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await page.getByRole("button", { name: "This month", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Budget remaining/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Money out/ }).click();
    expect(new URL(page.url()).searchParams.get("from")).toBe(month + "-01");
    expect(new URL(page.url()).searchParams.get("owner")).toBe(owner);
  } finally {
    await db.$disconnect();
  }
});

test("category and bill appearance survives edits and reloads", async ({
  page,
}, info) => {
  const { db, accounts, food } = await seed(page);
  try {
    await page.goto("/categories");
    await page.getByRole("button", { name: /^Groceries expense/ }).click();
    let dialog = page.getByRole("dialog");
    await choose(
      page,
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
      "heart",
    );
    await dialog
      .getByRole("button", { name: "Save category", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.getByRole("button", { name: /^Groceries expense/ }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Icon", exact: true }),
    ).toContainText("heart");
    expect(
      (await db.category.findUniqueOrThrow({ where: { id: food.id } })).icon,
    ).toBe("heart");
    await page.goto("/plan?tab=bills&view=recurring");
    await page
      .getByRole("button", { name: "Add schedule", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Name", { exact: true })
      .fill("Streaming membership");
    await dialog.getByLabel("Amount (AUD)", { exact: true }).fill("15.99");
    await choose(
      page,
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
      "tv",
    );
    await dialog.getByLabel("Colour", { exact: true }).fill("#668899");
    await dialog
      .getByRole("button", { name: "Add schedule", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page
      .getByRole("button", { name: "Edit Streaming membership", exact: true })
      .click();
    await expect(
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
    ).toContainText("tv");
    await expect(dialog.getByLabel("Colour", { exact: true })).toHaveValue(
      "#668899",
    );
    const schedule = await db.schedule.findFirstOrThrow({
      where: { name: "Streaming membership" },
    });
    expect(schedule).toMatchObject({
      icon: "tv",
      color: "#668899",
      accountId: accounts[0].id,
      amountCents: 1599n,
    });
    await dialog
      .getByRole("button", { name: "Use automatic appearance", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
    ).toHaveText("Automatic");
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } }))
        .icon,
    ).toBe("tv");
    await dialog
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page
      .getByRole("button", { name: "Edit Streaming membership", exact: true })
      .click();
    await expect(
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
    ).toHaveText("Automatic");
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } }))
        .color,
    ).toBeNull();
    await dialog
      .getByRole("combobox", { name: "Icon", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/visual-schedule-${info.project.name}.png`,
      scale: "css",
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await db.$disconnect();
  }
});

test("branded screens and collapsible mobile filters keep actions available", async ({
  page,
}, info) => {
  const { db, accounts } = await seed(page);
  try {
    await db.account.update({
      where: { id: accounts[0].id },
      data: { institution: "CBA", institutionPreset: "cba" },
    });
    for (const route of ["/transactions", "/expenses"]) {
      await page.goto(route);
      const filters = page.getByRole("button", { name: /^Filters/ });
      if (info.project.name === "mobile") {
        await expect(filters).toHaveAttribute("aria-expanded", "false");
        await filters.click();
        await expect(filters).toHaveAttribute("aria-expanded", "true");
      }
      const accountFilter = page.getByRole("button", {
        name: route === "/transactions" ? "Filter account" : "Account",
        exact: true,
      });
      await choose(page, accountFilter, "Everyday");
      await expect(
        page.getByRole("button", { name: "Remove filter: 1 account" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Remove filter: 1 account" })
        .click();
      await expect(
        page.getByRole("button", { name: "Remove filter: 1 account" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/visual-${route.slice(1)}-${info.project.name}.png`,
        scale: "css",
        fullPage: true,
        animations: "disabled",
      });
    }
    for (const [route, name] of [
      [`/accounts/${accounts[0].id}`, "account-detail"],
      [`/imports?account=${accounts[0].id}`, "csv-import"],
      [`/accounts/${accounts[0].id}/statement`, "statement-import"],
      ["/net-worth", "net-worth"],
      ["/assets", "assets"],
      ["/settings", "settings"],
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/visual-${name}-${info.project.name}.png`,
        scale: "css",
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await db.$disconnect();
  }
});
