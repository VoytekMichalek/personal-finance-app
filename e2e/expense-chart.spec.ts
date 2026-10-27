import {
  test,
  expect,
  session,
  choose,
  chooseDate,
  database,
} from "./fixtures";

test("category stacks switch calendar intervals and transactions paginate within report filters", async ({
  page,
}, info) => {
  const owner = await session(page);
  const headers = { Origin: "http://localhost:3000" };
  const accountResponse = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Everyday",
      type: "bank",
      owner,
      openingDate: "2026-01-01",
      openingBalanceCents: 100000,
    },
  });
  expect(accountResponse.ok()).toBe(true);
  const account = await accountResponse.json();
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  const groceries = snapshot.categories.find(
    (category: { name: string }) => category.name === "Groceries",
  );
  const transport = snapshot.categories.find(
    (category: { name: string }) => category.name === "Transport",
  );
  const longDescription =
    "Weekly groceries with a very long merchant description and reference ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const rows = [
    ...Array.from({ length: 10 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      amountCents: 1000,
      kind: "expense",
      categoryId: groceries.id,
      description:
        index === 9 ? longDescription : `Grocery purchase ${index + 1}`,
      owner,
    })),
    {
      date: "2026-01-05",
      amountCents: 2000,
      kind: "expense",
      categoryId: transport.id,
      description: "Train tickets",
      owner,
    },
    {
      date: "2026-01-31",
      amountCents: 500,
      kind: "expense",
      categoryId: null,
      description: "Other purchase",
      owner,
    },
    {
      date: "2026-02-01",
      amountCents: 2500,
      kind: "refund",
      categoryId: groceries.id,
      description: "Grocery refund",
      owner,
    },
    {
      date: "2026-01-05",
      amountCents: 9000,
      kind: "expense",
      categoryId: groceries.id,
      description: "Household purchase",
      owner: "household",
    },
  ];
  for (const row of rows) {
    const response = await page.request.post("/api/transactions", {
      headers,
      data: { ...row, accountId: account.id },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history", exact: true }).click();
  await chooseDate(
    page,
    page.getByRole("button", { name: "To", exact: true }),
    "2026-03-02",
  );
  await choose(
    page,
    page.getByRole("combobox", { name: "Person", exact: true }),
    "Voytek",
  );
  const chart = page.getByRole("region", {
    name: "Expenses by category and month",
    exact: true,
  });
  await expect(chart.locator(".recharts-bar")).toHaveCount(3);
  await expect(chart.locator(".recharts-bar-rectangle").first()).toBeVisible();
  expect((await chart.boundingBox())!.height).toBeLessThanOrEqual(280);
  const breakdown = page.getByRole("region", { name: "Breakdown totals" });
  expect((await breakdown.boundingBox())!.height).toBeLessThanOrEqual(320);
  await page.getByText("View chart values", { exact: true }).click();
  const values = page.getByRole("table", {
    name: "Expenses by category and month",
  });
  await expect(
    values.getByRole("row").filter({ hasText: "1 Jan 2026 – 31 Jan 2026" }),
  ).toContainText("$125.00");
  await expect(
    values.getByRole("row").filter({ hasText: "1 Feb 2026 – 28 Feb 2026" }),
  ).toContainText("-$25.00");
  await expect(
    values.getByRole("row").filter({ hasText: "1 Mar 2026 – 2 Mar 2026" }),
  ).toContainText("$0.00");
  const interval = page.getByRole("group", { name: "Chart interval" });
  await interval.getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    interval.getByRole("button", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const weeks = page.getByRole("table", {
    name: "Expenses by category and week",
  });
  await expect(
    weeks.getByRole("row").filter({ hasText: "1 Jan 2026 – 4 Jan 2026" }),
  ).toContainText("$40.00");
  await expect(
    weeks.getByRole("row").filter({ hasText: "26 Jan 2026 – 1 Feb 2026" }),
  ).toContainText("-$20.00");
  await interval.getByRole("button", { name: "Day", exact: true }).click();
  const days = page.getByRole("table", {
    name: "Expenses by category and day",
  });
  await expect(
    days.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "5 Jan 2026", exact: true }),
    }),
  ).toContainText("$30.00");
  await expect(
    days.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "1 Feb 2026", exact: true }),
    }),
  ).toContainText("-$25.00");
  const dailyChart = page.getByRole("region", {
    name: "Expenses by category and day",
    exact: true,
  });
  expect(
    await dailyChart.evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page.getByText("View chart values", { exact: true }).click();
  await interval.getByRole("button", { name: "Month", exact: true }).click();
  const transactions = page.getByRole("list", { name: "Expense transactions" });
  await expect(transactions.getByRole("listitem")).toHaveCount(10);
  await expect(transactions.getByRole("listitem").first()).toContainText(
    "Grocery refund",
  );
  await expect(transactions.getByRole("listitem").first()).toContainText(
    "-$25.00",
  );
  await expect(transactions.getByText(longDescription)).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "1–10 of 13 transactions",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  if (info.project.name === "desktop") {
    expect(
      (await page.locator("main").boundingBox())!.x,
    ).toBeGreaterThanOrEqual(240);
  }
  await page.screenshot({
    path: `artifacts/expense-chart-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 1714, height: 1100 });
    await expect(transactions).toHaveJSProperty(
      "scrollWidth",
      await transactions.evaluate((el) => el.clientWidth),
    );
    await page.screenshot({
      path: "artifacts/expense-chart-wide.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  } else {
    await page
      .getByRole("heading", { name: "Expenses over time" })
      .locator("../..")
      .locator("..")
      .screenshot({
        path: "artifacts/expense-chart-mobile-detail.png",
        animations: "disabled",
      });
  }
  await page.getByRole("button", { name: "Next transactions" }).click();
  await expect(page.getByRole("status")).toContainText(
    "11–13 of 13 transactions",
  );
  await expect(transactions.getByRole("listitem")).toHaveCount(3);
  await expect(
    transactions.getByText("Grocery purchase 1", { exact: true }),
  ).toBeVisible();
  await choose(
    page,
    page.getByRole("combobox", { name: "Category", exact: true }),
    "Groceries",
  );
  await expect(page.getByRole("status")).toContainText(
    "1–10 of 11 transactions",
  );
  await expect(chart.locator(".recharts-bar")).toHaveCount(1);
  await expect(transactions.getByText("Train tickets")).toHaveCount(0);
  await expect(transactions.getByText("Household purchase")).toHaveCount(0);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
  await expect(transactions).toHaveJSProperty(
    "scrollWidth",
    await transactions.evaluate((el) => el.clientWidth),
  );
  await chooseDate(
    page,
    page.getByRole("button", { name: "From", exact: true }),
    "2026-03-01",
  );
  await expect(
    page.getByRole("heading", { name: "Included transactions · 0" }),
  ).toBeVisible();
  await expect(
    page.getByText("No transactions in this selection."),
  ).toBeVisible();
  await expect(chart).toHaveCount(0);
});

test("a long category breakdown stays compact and every category remains reachable", async ({
  page,
}) => {
  const owner = await session(page);
  const db = await database();
  let categoryCount: number;
  try {
    const categories = await db.category.findMany({
      where: { kind: "expense" },
      take: 12,
    });
    expect(categories.length).toBeGreaterThanOrEqual(8);
    categoryCount = categories.length;
    const account = await db.account.create({
      data: {
        name: "Category test",
        type: "bank",
        owner,
        openingDate: "2026-01-01",
        openingBalanceCents: 100000,
      },
    });
    await db.transaction.createMany({
      data: categories.map((category, index) => ({
        accountId: account.id,
        owner,
        date: "2026-01-05",
        description: `Category purchase ${index + 1}`,
        kind: "expense",
        amountCents: -1000,
        categoryId: category.id,
      })),
    });
  } finally {
    await db.$disconnect();
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history" }).click();
  const breakdown = page.getByRole("region", { name: "Breakdown totals" });
  await expect(breakdown.getByRole("button")).toHaveCount(categoryCount);
  expect((await breakdown.boundingBox())!.height).toBeLessThanOrEqual(320);
  expect(
    await breakdown.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await breakdown.getByRole("button").last().click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Transactions · 1" }),
  ).toBeVisible();
  await expect(
    dialog
      .getByRole("list", { name: "Expense transactions" })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(breakdown.getByRole("button").last()).toBeFocused();
});
