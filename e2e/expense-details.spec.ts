import { test, expect, session, tickFilter } from "./fixtures";
const headers = { Origin: "http://localhost:3000" };
test("expense breakdown opens filtered transactions and a complete period trend", async ({
  page,
}, info) => {
  const owner = await session(page);
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
  const category = snapshot.categories.find(
    (c: { name: string }) => c.name === "Groceries",
  );
  for (const [kind, amountCents, date, description, person, categoryId] of [
    ["expense", 10000, "2026-01-05", "Weekly groceries", owner, category.id],
    ["refund", 2500, "2026-04-05", "Grocery refund", owner, category.id],
    [
      "expense",
      5000,
      "2026-02-05",
      "Household groceries",
      "household",
      category.id,
    ],
    ["expense", 2000, "2026-03-05", "Other purchase", owner, null],
  ]) {
    const response = await page.request.post("/api/transactions", {
      headers,
      data: {
        accountId: account.id,
        kind,
        amountCents,
        date,
        description,
        owner: person,
        categoryId,
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history" }).click();
  await tickFilter(page, "Person", ["Voytek"]);
  const trigger = page.getByRole("button", {
    name: "View Groceries transactions",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Groceries", exact: true });
  await expect(
    dialog.getByRole("heading", { name: "Transactions · 2" }),
  ).toBeVisible();
  await expect(dialog.getByText("$75.00", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("img", { name: "Groceries spending trend" }),
  ).toBeVisible();
  await expect(
    dialog
      .getByRole("img", { name: "Groceries spending trend" })
      .getByText("Jan 2026", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: "Table", exact: true }).click();
  const trend = dialog.getByRole("table");
  await expect(
    trend.getByRole("row").filter({ hasText: "Feb 2026" }),
  ).toContainText("$0.00");
  await expect(
    trend.getByRole("row").filter({ hasText: "Apr 2026" }),
  ).toContainText("-$25.00");
  await expect(
    dialog.getByText("Weekly groceries", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Grocery refund", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Household groceries", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByText("Other purchase", { exact: true })).toHaveCount(
    0,
  );
  await expect(dialog).toHaveJSProperty(
    "scrollWidth",
    await dialog.evaluate((el) => el.clientWidth),
  );
  await dialog.getByRole("tab", { name: "Graph", exact: true }).click();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `artifacts/expense-drilldown-${info.project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(trigger).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Person", exact: true }),
  ).toHaveText("Voytek");
  await page
    .getByRole("button", { name: "View Uncategorised transactions" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Other purchase", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Transactions · 1" }),
  ).toBeVisible();
});
test("category colour is a compact accessible dot", async ({ page }, info) => {
  await session(page);
  await page.goto("/categories");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  const colour = page.getByLabel("Colour", { exact: true });
  await expect(colour).toHaveAttribute("type", "color");
  const dimensions = await colour.boundingBox();
  expect(dimensions?.width).toBe(44);
  expect(dimensions?.height).toBe(44);
  await colour.focus();
  await expect(colour).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Save category", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `artifacts/category-colour-${info.project.name}.png`,
  });
});
