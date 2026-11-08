import type { Page } from "@playwright/test";
import {
  test,
  expect,
  session,
  database,
  choose,
  tickFilter,
  choosePeriod,
} from "./fixtures";

async function seedExpenses(page: Page) {
  const owner = await session(page);
  const db = await database();
  const bank = await db.account.create({
    data: {
      name: "Bank",
      type: "bank",
      owner,
      openingDate: "2026-01-01",
      openingBalanceCents: 100000n,
    },
  });
  const hidden = await db.account.create({
    data: {
      name: "Hidden bank",
      type: "bank",
      owner,
      openingDate: "2026-01-01",
      openingBalanceCents: 100000n,
    },
  });
  const grocery = await db.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const dining = await db.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const rows = [];
  for (let index = 0; index < 3; index++)
    rows.push(
      await db.transaction.create({
        data: {
          accountId: index === 2 ? hidden.id : bank.id,
          date: `2026-10-0${index + 1}`,
          description: "Local shop",
          amountCents: -1000n,
          kind: "expense",
          owner,
          categoryId: grocery.id,
        },
      }),
    );
  return { db, grocery, dining, rows };
}

test("expense categories and filtered rules remain editable through report drill-downs", async ({
  page,
}, info) => {
  const { db, grocery, dining, rows } = await seedExpenses(page);
  await page.goto("/expenses");
  await choosePeriod(page, "All history");
  await tickFilter(page, "Account", ["Bank"]);
  const list = page.getByRole("list", {
    name: "Expense transactions",
    exact: true,
  });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await choose(
    page,
    list
      .getByRole("combobox", { name: "Category for Local shop", exact: true })
      .first(),
    "Dining",
  );
  await expect(
    list
      .getByRole("combobox", { name: "Category for Local shop", exact: true })
      .first(),
  ).toContainText("Dining");
  await list
    .getByRole("button", { name: /Remember/ })
    .first()
    .click();
  const remember = page.getByRole("dialog", {
    name: "Remember this transaction",
  });
  await expect(remember).toContainText("2 matching transactions");
  await remember
    .getByRole("button", { name: "Save rule & apply to 2" })
    .click();
  await expect(remember).toBeHidden();
  await expect(
    list.getByRole("combobox").filter({ hasText: "Dining" }),
  ).toHaveCount(2);
  expect(
    (await db.transaction.findUniqueOrThrow({ where: { id: rows[2].id } }))
      .categoryId,
  ).toBe(grocery.id);
  expect((await db.rule.findFirstOrThrow()).categoryId).toBe(dining.id);
  const savedRules = list.getByRole("button", {
    name: "Matches saved rule for Local shop",
    exact: true,
  });
  await expect(savedRules).toHaveCount(2);
  await expect(list.getByRole("button", { name: /^Remember / })).toHaveCount(0);
  await savedRules.first().click();
  await expect(remember).toContainText("0 to update · 2 already correct.");
  await remember.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", { name: "View Dining transactions", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "Dining", exact: true });
  const detailCategory = detail
    .getByRole("combobox", { name: "Category for Local shop", exact: true })
    .first();
  // Wait for the dialog control before the generic picker helper considers
  // the page's mobile filter toggle beneath this opening modal.
  await expect(detailCategory).toBeVisible();
  await choose(
    page,
    detailCategory,
    "+ Create category",
  );
  const create = page.getByRole("dialog", {
    name: "Add category",
    exact: true,
  });
  await create.getByLabel("Name", { exact: true }).fill("Household supplies");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create).toBeHidden();
  await expect(
    detail.getByRole("heading", { name: "Transactions · 1", exact: true }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  if (info.project.name === "desktop") {
    await expect
      .poll(async () =>
        page.locator("main").evaluate((el) => el.getBoundingClientRect().left),
      )
      .toBe(240);
  }
  await page.screenshot({
    path: `artifacts/expense-category-editing-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await db.$disconnect();
});

test("transaction category edits persist in details and dashboard links retain their month", async ({
  page,
}) => {
  const { db } = await seedExpenses(page);
  await page.goto("/transactions?search=Local+shop");
  const category = page
    .getByRole("combobox", { name: "Category for Local shop", exact: true })
    .first();
  await choose(page, category, "Transport");
  await expect(category).toContainText("Transport");
  await page
    .getByRole("button", { name: /^Local shop \d/ })
    .first()
    .click();
  const transaction = page.getByRole("dialog", {
    name: "Local shop",
    exact: true,
  });
  const transactionCategory = transaction.getByRole("combobox", {
    name: "Category for Local shop",
    exact: true,
  });
  await expect(transactionCategory).toBeVisible();
  await choose(
    page,
    transactionCategory,
    "Groceries",
  );
  await expect(transaction.getByRole("combobox")).toContainText("Groceries");
  await page.reload();
  await expect(page.getByRole("dialog").getByRole("combobox")).toContainText(
    "Groceries",
  );
  for (const [label, hint, kind] of [
    ["Money in", "Income in Oct 2026", "income"],
    ["Money out", "Expenses, less refunds", "expense"],
  ]) {
    await page.goto("/?month=2026-10");
    const summary = page.getByRole("button", { name: new RegExp(label!) });
    await expect(summary).toContainText(hint!);
    await summary.click();
    await expect(page).toHaveURL(
      new RegExp(
        `/transactions\\?kind=${kind}&from=2026-10-01&to=2026-10-31`,
      ),
    );
  }
  await db.$disconnect();
});
