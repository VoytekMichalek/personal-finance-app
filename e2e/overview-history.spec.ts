import { test, expect, choose } from "./fixtures";
import { seed, day } from "./ux-fixtures";
import { addDays, displayDate, monthEnd } from "../packages/shared/src/index";

test("dashboard distinguishes recorded history from projections and drills into past spending for the selected person", async ({
  page,
}, info) => {
  const { db, accounts, owner, person, food } = await seed(page);
  const previous = addDays(day.slice(0, 7) + "-01", -1).slice(0, 7);
  try {
    await db.transaction.createMany({
      data: [
        {
          accountId: accounts[0].id,
          owner,
          kind: "expense",
          date: previous + "-10",
          description: "Past groceries",
          categoryId: food.id,
          amountCents: -10000n,
        },
        {
          accountId: accounts[0].id,
          owner,
          kind: "refund",
          date: previous + "-12",
          description: "Past refund",
          categoryId: food.id,
          amountCents: 2500n,
        },
        {
          accountId: accounts[2].id,
          owner: person.id,
          kind: "expense",
          date: previous + "-10",
          description: "Other person groceries",
          categoryId: food.id,
          amountCents: -5000n,
        },
        {
          accountId: accounts[0].id,
          owner,
          kind: "transfer",
          date: previous + "-12",
          description: "Past transfer",
          amountCents: -10000n,
        },
        {
          accountId: accounts[1].id,
          owner,
          kind: "transfer",
          date: previous + "-12",
          description: "Past transfer",
          amountCents: 10000n,
        },
      ],
    });
    await page.goto("/");
    const history = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Household balance & outlook",
        exact: true,
      }),
    });
    const spending = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Past spending", exact: true }),
    });
    await expect(spending.getByText("$125.00", { exact: true })).toHaveCount(2);
    const graph = history.getByRole("img");
    await expect(graph).toHaveAttribute(
      "aria-label",
      /Six months of recorded history.*three months projected/,
    );
    await expect(graph.locator(".recharts-line-curve")).toHaveCount(2);
    await expect(
      graph.locator(".recharts-line-curve").nth(0),
    ).not.toHaveAttribute("stroke-dasharray");
    await expect(graph.locator(".recharts-line-curve").nth(1)).toHaveAttribute(
      "stroke-dasharray",
      "2 5",
    );
    await history.getByRole("tab", { name: "Table", exact: true }).click();
    const current = history.getByRole("row").filter({
      has: page.getByRole("cell", { name: displayDate(day), exact: true }),
    });
    await expect(current).toContainText("Recorded");
    await expect(current).toContainText("$29,804.00");
    await expect(
      history.getByRole("row").filter({
        has: page.getByRole("cell", {
          name: displayDate(addDays(day, 1)),
          exact: true,
        }),
      }),
    ).toContainText("Projected");
    await history.getByRole("tab", { name: "Graph", exact: true }).click();
    await choose(
      page,
      page.getByRole("combobox", { name: "Ownership filter" }),
      "Voytek",
    );
    await expect(spending.getByText("$75.00", { exact: true })).toHaveCount(2);
    await history
      .getByRole("button", {
        name: "About Household balance & outlook",
        exact: true,
      })
      .focus();
    await expect(page.getByRole("tooltip")).toContainText(
      "Whole household · bank and cash, less credit owed",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Top spending categories",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent activity", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (info.project.name === "desktop") {
      await expect(page.locator("main")).toHaveCSS("margin-left", "240px");
      await expect
        .poll(async () => (await page.locator("main").boundingBox())!.x)
        .toBe(240);
    }
    await page.screenshot({
      path: `artifacts/ux-overview-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: `artifacts/ux-overview-viewport-${info.project.name}.png`,
      animations: "disabled",
    });
    await spending.getByRole("link", { name: /\$75\.00/ }).click();
    await expect(page).toHaveURL(new RegExp(`owner=${owner}`));
    await expect(page).toHaveURL(new RegExp(`from=${previous}-01`));
    await expect(page).toHaveURL(new RegExp(`to=${monthEnd(previous)}`));
    await expect(
      page
        .getByText("Past groceries", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Past refund", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Other person groceries", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Past transfer", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await db.$disconnect();
  }
});
