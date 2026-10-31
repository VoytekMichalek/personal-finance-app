import { test, expect, session, tickFilter } from "./fixtures";

test("expense search filters totals, charts and drill-downs and clears with keyboard focus", async ({
  page,
}, info) => {
  const owner = await session(page);
  const headers = { Origin: "http://localhost:3000" };
  const accountResponse = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Search account",
      type: "bank",
      owner,
      openingDate: "2026-01-01",
      openingBalanceCents: 100000,
    },
  });
  expect(accountResponse.ok()).toBe(true);
  const account = await accountResponse.json();
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  const category = snapshot.categories.find(
    (item: { name: string }) => item.name === "Groceries",
  );
  for (const [kind, amountCents, description, categoryId] of [
    ["expense", 4000, "Funky shop purchase", category.id],
    ["refund", 1500, "FUNKY shop refund", category.id],
    ["expense", 700, "Other purchase", null],
  ]) {
    const response = await page.request.post("/api/transactions", {
      headers,
      data: {
        accountId: account.id,
        date: "2026-01-01",
        owner,
        kind,
        amountCents,
        description,
        categoryId,
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search expenses" });
  const clear = page.getByRole("button", { name: "Clear search", exact: true });
  const included = page.getByRole("heading", {
    name: "Included transactions · 3",
  });
  await expect(included).toBeVisible();
  await expect(clear).toHaveCount(0);
  await search.fill("  funky  ");
  await expect(
    page.getByRole("heading", { name: "Included transactions · 2" }),
  ).toBeVisible();
  await expect(page.getByText("$25.00", { exact: true }).first()).toBeVisible();
  const chart = page.getByRole("region", {
    name: "Expenses by category and month",
    exact: true,
  });
  await expect(chart.locator(".recharts-bar")).toHaveCount(1);
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  const values = page.getByRole("table", {
    name: "Expenses by category and month",
  });
  await expect(
    values.getByRole("row").filter({ hasText: "1 Jan 2026 – 31 Jan 2026" }),
  ).toContainText("$25.00");
  await page
    .getByRole("button", { name: "View Groceries transactions", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Groceries", exact: true });
  await expect(
    dialog.getByRole("heading", { name: "Transactions · 2" }),
  ).toBeVisible();
  await expect(dialog.getByText("Other purchase", { exact: true })).toHaveCount(
    0,
  );
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await clear.click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(included).toBeVisible();
  await search.fill("not found");
  await expect(
    page.getByRole("heading", { name: "Included transactions · 0" }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(included).toBeVisible();
  await tickFilter(page, "Category", ["Uncategorised"]);
  await expect(
    page.getByRole("heading", { name: "Included transactions · 1" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Expense transactions" })
      .getByText("Other purchase", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Graph", exact: true }).click();
  await expect(page.getByRole("list", { name: "Chart categories" })).toHaveText(
    "Uncategorised",
  );
  await search.fill("other");
  await expect(
    page.getByRole("heading", { name: "Included transactions · 1" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((element) => element.clientWidth),
  );
  await page.screenshot({
    path: `artifacts/expense-search-${info.project.name}.png`,
  });
});
