import { test, expect, chooseMonth, monthText } from "./fixtures";
import { seed, day, month } from "./ux-fixtures";
import { shiftMonth } from "../packages/shared/src/index";

test("budget reporting reconciles actuals, bills, unbudgeted spend and monthly trends", async ({
  page,
}, info) => {
  const { db, accounts, food } = await seed(page);
  const previous = shiftMonth(month, -1);
  try {
    const subscriptions = await db.category.findFirstOrThrow({
      where: { name: "Subscriptions" },
    });
    await db.budget.createMany({
      data: [
        {
          categoryId: subscriptions.id,
          month: previous,
          endMonth: shiftMonth(month, 1),
          amountCents: 20000n,
        },
        { categoryId: food.id, month, endMonth: month, amountCents: 2000n },
      ],
    });
    await db.transaction.createMany({
      data: [
        {
          accountId: accounts[0].id,
          categoryId: subscriptions.id,
          kind: "expense",
          date: day,
          amountCents: -5000n,
          description: "Streaming subscription",
        },
        {
          accountId: accounts[0].id,
          categoryId: subscriptions.id,
          kind: "refund",
          date: day,
          amountCents: 1000n,
          description: "Subscription refund",
        },
        {
          accountId: accounts[0].id,
          categoryId: subscriptions.id,
          kind: "expense",
          date: previous + "-15",
          amountCents: -15000n,
          description: "Last month subscriptions",
        },
      ],
    });
    await db.schedule.create({
      data: {
        name: "More subscriptions",
        accountId: accounts[0].id,
        categoryId: subscriptions.id,
        kind: "expense",
        amountCents: 10000n,
        startDate: day,
        frequency: "monthly",
        subscription: true,
      },
    });
    await page.goto("/");
    if (info.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Budget vs actual", exact: true })
        .click();
    } else {
      const navigation = page.getByRole("complementary", {
        name: "Primary navigation",
      });
      await navigation
        .getByRole("link", { name: "Budget vs actual", exact: true })
        .click();
      await expect(
        navigation.getByRole("link", { name: "Budget vs actual", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
    await expect(page).toHaveURL(/\/budget-report$/);
    await expect(
      page.getByRole("heading", { name: "Budget vs actual", exact: true }),
    ).toBeVisible();
    const row = page.getByRole("listitem", {
      name: "Subscriptions budget performance",
      exact: true,
    });
    await expect(row).toContainText("$200.00");
    await expect(
      row.getByRole("link", {
        name: "View Subscriptions actual transactions",
        exact: true,
      }),
    ).toHaveText("$40.00");
    await expect(row).toContainText("$100.00");
    await expect(row).toContainText("$60.00");
    const usage = row.getByRole("meter");
    await expect(usage).toHaveAttribute("aria-valuemax", "150");
    await expect(usage).toHaveAttribute("aria-valuenow", "70");
    await expect(usage).toHaveAttribute("aria-valuetext", /70%.*Within budget/);
    await expect(row.getByText("70%", { exact: true })).toHaveClass(
      /text-emerald-700/,
    );
    const geometry = await usage.evaluate((element) => {
      const track = element.getBoundingClientRect();
      const fill = element.firstElementChild!.getBoundingClientRect();
      const marker = element
        .querySelector('[aria-hidden="true"]')!
        .getBoundingClientRect();
      return {
        width: track.width,
        fill: fill.width / track.width,
        marker: (marker.x - track.x) / track.width,
      };
    });
    expect(geometry.width).toBeLessThan(200);
    expect(geometry.fill).toBeCloseTo(70 / 150, 2);
    expect(geometry.marker).toBeCloseTo(100 / 150, 2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText("$35.00 of recorded spending has no budget.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Over budget (1)", exact: true })
      .click();
    await expect(
      page.getByRole("listitem", { name: "Groceries budget performance" }),
    ).toContainText("$12.00 over");
    await expect(row).toBeHidden();
    const over = page.getByRole("listitem", {
      name: "Groceries budget performance",
    });
    await expect(over.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      "150",
    );
    await expect(over.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      /160%.*Over budget/,
    );
    await expect(over.getByText("160%", { exact: true })).toHaveClass(
      /text-rose-700/,
    );
    expect(
      await over
        .getByRole("meter")
        .evaluate(
          (element) =>
            element.firstElementChild!.getBoundingClientRect().width /
            element.getBoundingClientRect().width,
        ),
    ).toBeCloseTo(1, 2);
    await page.getByRole("button", { name: "Unbudgeted", exact: true }).click();
    await expect(
      page.getByRole("listitem", { name: "Dining budget performance" }),
    ).toContainText("No budget set");
    await expect(
      page
        .getByRole("listitem", { name: "Dining budget performance" })
        .getByRole("meter"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("listitem", { name: "Uncategorised budget performance" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "All categories", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/budget-report-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    const trend = page.getByRole("table", {
      name: "Monthly budget and actual spending",
    });
    await expect(
      trend.getByRole("row", { name: new RegExp(monthText(month)) }),
    ).toContainText("$107.00");
    await trend
      .getByRole("button", { name: monthText(previous), exact: true })
      .click();
    await expect(page.getByLabel("Report month")).toHaveText(
      monthText(previous),
    );
    await expect(
      page.getByText("Completed calendar month", { exact: false }),
    ).toBeVisible();
    await expect(row.getByRole("link")).toHaveText("$150.00");
    await chooseMonth(page, page.getByLabel("Report month"), month);
    await row
      .getByRole("link", {
        name: "View Subscriptions actual transactions",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`category=${subscriptions.id}.*from=${month}-01&to=${day}`),
    );
    await expect(
      page
        .getByText("Streaming subscription", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Subscription refund", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.goBack();
    await page.getByRole("link", { name: "Edit budgets", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`tab=budgets&month=${month}`));
    await expect(page.getByLabel("Budget month")).toHaveText(monthText(month));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});

test("budget usage handles exact allowances, zero budgets and upcoming shortfalls", async ({
  page,
}) => {
  const { db, accounts, food, dining } = await seed(page);
  try {
    const subscriptions = await db.category.findFirstOrThrow({
      where: { name: "Subscriptions" },
    });
    const utilities = await db.category.findFirstOrThrow({
      where: { name: "Utilities" },
    });
    await db.budget.createMany({
      data: [
        { categoryId: food.id, month, endMonth: month, amountCents: 3200n },
        { categoryId: dining.id, month, endMonth: month, amountCents: 0n },
        { categoryId: utilities.id, month, endMonth: month, amountCents: 0n },
        {
          categoryId: subscriptions.id,
          month,
          endMonth: month,
          amountCents: 1000n,
        },
      ],
    });
    await db.schedule.create({
      data: {
        name: "Upcoming subscription",
        accountId: accounts[0].id,
        categoryId: subscriptions.id,
        kind: "expense",
        amountCents: 1500n,
        startDate: day,
        frequency: "monthly",
      },
    });
    await page.goto(`/plan?tab=report&month=${month}`);
    await expect(page).toHaveURL(
      new RegExp(`/budget-report\\?month=${month}$`),
    );
    const grocery = page.getByRole("listitem", {
      name: "Groceries budget performance",
    });
    await expect(grocery.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(grocery.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      /100%.*Within budget/,
    );
    await expect(
      grocery
        .getByText("100%", { exact: true })
        .filter({ hasNot: page.locator("*") })
        .last(),
    ).toHaveClass(/text-emerald-700/);
    const zero = page.getByRole("listitem", {
      name: "Dining budget performance",
    });
    await expect(zero).toContainText("Over budget · no allowance");
    await expect(zero.getByRole("meter")).toHaveCount(0);
    const empty = page.getByRole("listitem", {
      name: "Utilities budget performance",
    });
    await expect(empty.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await expect(empty.getByText("0%", { exact: true })).toHaveClass(
      /text-emerald-700/,
    );
    const upcoming = page.getByRole("listitem", {
      name: "Subscriptions budget performance",
    });
    await expect(upcoming.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      /150%.*Over budget/,
    );
    await expect(upcoming.getByText("150%", { exact: true })).toHaveClass(
      /text-rose-700/,
    );
  } finally {
    await db.$disconnect();
  }
});
