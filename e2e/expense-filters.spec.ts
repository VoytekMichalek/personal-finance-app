import { test, expect, session, database, tickFilter } from "./fixtures";

test("expense filters tick multiple accounts, people and categories; graph/table tabs retain totals and keyboard focus", async ({
  page,
}, info) => {
  const owner = await session(page);
  const db = await database();
  try {
    const accounts = await Promise.all(
      ["Bank", "Card", "Hidden"].map((name) =>
        db.account.create({
          data: {
            name,
            type: "bank",
            owner,
            openingDate: "2026-01-01",
            openingBalanceCents: 100000n,
          },
        }),
      ),
    );
    const groceries = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    const transport = await db.category.findFirstOrThrow({
      where: { name: "Transport" },
    });
    const base = {
      accountId: accounts[0].id,
      owner,
      date: "2026-01-05",
      kind: "expense",
      amountCents: -1000n,
      categoryId: groceries.id,
    };
    await db.transaction.createMany({
      data: [
        { ...base, description: "Bank grocery" },
        {
          ...base,
          description: "Card transport",
          accountId: accounts[1].id,
          owner: "household",
          categoryId: transport.id,
          amountCents: -2000n,
        },
        { ...base, description: "Refund", kind: "refund", amountCents: 300n },
        {
          ...base,
          description: "Uncategorised",
          categoryId: null,
          amountCents: -700n,
        },
        {
          ...base,
          description: "Hidden account",
          accountId: accounts[2].id,
          amountCents: -9999n,
        },
      ],
    });
  } finally {
    await db.$disconnect();
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history", exact: true }).click();
  await tickFilter(page, "Account", ["Bank", "Card"]);
  await tickFilter(page, "Person", ["Voytek", "Household"]);
  await tickFilter(page, "Category", ["Groceries", "Transport"]);
  for (const name of ["Account", "Person", "Category"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveText(
      "2 selected",
    );
  await expect(
    page.getByRole("heading", { name: "Included transactions · 3" }),
  ).toBeVisible();
  await expect(page.getByText("$27.00", { exact: true }).first()).toBeVisible();
  const legend = page.getByRole("list", { name: "Chart categories" });
  await expect(legend.getByRole("listitem")).toHaveCount(2);
  await expect(legend).toHaveJSProperty(
    "scrollWidth",
    await legend.evaluate((el) => el.clientWidth),
  );
  const graph = page.getByRole("tab", { name: "Graph", exact: true });
  const table = page.getByRole("tab", { name: "Table", exact: true });
  await graph.focus();
  await graph.press("ArrowRight");
  await expect(table).toBeFocused();
  await expect(table).toHaveAttribute("aria-selected", "true");
  await expect(legend).toBeHidden();
  await expect(
    page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: "5 Jan 2026 – 31 Jan 2026" }),
  ).toContainText("$27.00");
  await table.press("Home");
  await expect(graph).toBeFocused();
  await expect(legend).toBeVisible();
  await page.screenshot({
    path: `artifacts/expense-multi-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View Transport transactions", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Transactions · 1" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Card transport", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Category", exact: true }).click();
  const option = page.getByRole("menuitemcheckbox", {
    name: "Transport",
    exact: true,
  });
  await expect(option).toHaveAttribute("aria-checked", "true");
  await option.click();
  await expect(option).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Included transactions · 2" }),
  ).toBeVisible();
  await tickFilter(page, "Category", ["All categories"]);
  await expect(
    page.getByRole("heading", { name: "Included transactions · 4" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
