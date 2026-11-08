import { test, expect, session, database, revealFilter } from "./fixtures";

for (const view of ["transactions", "account", "expenses"] as const) {
  test(`category Select all ticks every option and excludes one in ${view}`, async ({
    page,
  }, info) => {
    await session(page);
    const db = await database();
    let accountId: string;
    let optionCount: number;
    try {
      const account = await db.account.create({
        data: {
          name: "Category selection account",
          type: "bank",
          openingDate: "2026-01-01",
          openingBalanceCents: 100000n,
        },
      });
      accountId = account.id;
      const home = await db.category.findFirstOrThrow({
        where: { name: "Home" },
      });
      const groceries = await db.category.findFirstOrThrow({
        where: { name: "Groceries" },
      });
      const salary = await db.category.findFirstOrThrow({
        where: { name: "Salary" },
      });
      const insurance = await db.category.create({
        data: {
          name: "Insurance",
          kind: "expense",
          color: "#123456",
          parentId: home.id,
          archived: true,
        },
      });
      optionCount =
        1 +
        (await db.category.count({
          where: view === "expenses" ? { kind: "expense" } : {},
        }));
      await db.transaction.createMany({
        data: [
          {
            description: "Parent payment",
            categoryId: home.id,
            amountCents: -1000n,
          },
          {
            description: "Child payment",
            categoryId: insurance.id,
            amountCents: -2500n,
          },
          {
            description: "Grocery payment",
            categoryId: groceries.id,
            amountCents: -3000n,
          },
          {
            description: "Unclassified payment",
            categoryId: null,
            amountCents: -700n,
          },
          {
            description: "Salary payment",
            categoryId: salary.id,
            amountCents: 5000n,
            kind: "income",
          },
        ].map((row) => ({
          accountId,
          date: "2026-01-05",
          kind: "expense",
          ...row,
        })),
      });
    } finally {
      await db.$disconnect();
    }
    const path = view === "account" ? `/accounts/${accountId}` : `/${view}`;
    await page.goto(`${path}?from=2026-01-01&to=2026-01-31`);
    const trigger = page.getByRole("button", {
      name: view === "expenses" ? "Category" : "Filter category",
      exact: true,
    });
    await revealFilter(page, trigger);
    await trigger.click();
    const menu = page.getByRole("menu");
    const all = menu.getByRole("menuitemcheckbox", {
      name: "All categories",
      exact: true,
    });
    const selectAll = menu.getByRole("menuitem", {
      name: "Select all",
      exact: true,
    });
    const child = menu.getByRole("menuitemcheckbox", {
      name: "Home / Insurance",
      exact: true,
    });
    const parent = menu.getByRole("menuitemcheckbox", {
      name: "Home",
      exact: true,
    });
    await expect(all).toHaveAttribute("aria-checked", "true");
    await selectAll.focus();
    await selectAll.press("Enter");
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitemcheckbox", { checked: true }),
    ).toHaveCount(optionCount);
    await expect(all).toHaveAttribute("aria-checked", "false");
    await page.screenshot({
      path: `artifacts/category-select-all-${view}-${info.project.name}.png`,
    });
    expect(
      await menu.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth;
      }),
    ).toBe(true);

    await child.click();
    await expect(child).toHaveAttribute("aria-checked", "false");
    await expect(parent).toHaveAttribute("aria-checked", "true");
    await expect(
      menu.getByRole("menuitemcheckbox", { checked: true }),
    ).toHaveCount(optionCount - 1);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    const count = (n: number) =>
      view === "expenses"
        ? page.getByRole("heading", {
            name: `Included transactions · ${n}`,
            exact: true,
          })
        : page.getByRole("button", {
            name: `Select all ${n} matching transactions`,
            exact: true,
          });
    await expect(count(view === "expenses" ? 3 : 4)).toBeVisible();
    await expect(page.getByText("Child payment", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Parent payment", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Unclassified payment", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(count(view === "expenses" ? 3 : 4)).toBeVisible();
    await revealFilter(page, trigger);
    await trigger.click();
    await expect(child).toHaveAttribute("aria-checked", "false");
    await selectAll.click();
    await expect(child).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveText(`Categories (${optionCount})`);
    await expect(count(view === "expenses" ? 4 : 5)).toBeVisible();

    await revealFilter(page, trigger);
    await trigger.click();
    await all.click();
    await expect(
      menu.getByRole("menuitemcheckbox", { checked: true }),
    ).toHaveCount(1);
    await expect(all).toHaveAttribute("aria-checked", "true");
    if (view === "expenses") {
      await parent.click();
      await page.keyboard.press("Escape");
      // Clearing restores the existing parent-and-subcategories selection behaviour.
      await expect(count(2)).toBeVisible();
      await expect(
        page.getByText("Child payment", { exact: true }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.has("categoryMatch")).toBe(false);
    } else {
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveText("All categories");
    }
  });
}
