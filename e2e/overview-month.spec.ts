import { test, expect, choose, chooseMonth, monthText } from "./fixtures";
import { seed, day, month } from "./ux-fixtures";
import { addDays, monthEnd } from "../packages/shared/src/index";

test("overview month preserves ownership, totals and drill-down dates", async ({
  page,
}, info) => {
  const { db, accounts, owner, person, food } = await seed(page);
  const previous = addDays(month + "-01", -1).slice(0, 7);
  try {
    await db.transaction.createMany({
      data: [
        {
          accountId: accounts[0].id,
          owner,
          kind: "expense",
          date: monthEnd(previous),
          description: "Month end groceries",
          categoryId: food.id,
          amountCents: -10000n,
        },
        {
          accountId: accounts[0].id,
          owner,
          kind: "refund",
          date: monthEnd(previous),
          description: "Month end refund",
          categoryId: food.id,
          amountCents: 2500n,
        },
        {
          accountId: accounts[0].id,
          owner,
          kind: "income",
          date: previous + "-01",
          description: "Previous salary",
          amountCents: 200000n,
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
      ],
    });
    await db.budget.create({
      data: { month: previous, categoryId: food.id, amountCents: 50000n },
    });
    await page.goto("/");
    const picker = page.getByLabel("Overview month");
    const ownership = page.getByRole("combobox", { name: "Ownership filter" });
    const spending = page.getByRole("button", { name: /^Money out/ });
    const balance = await page
      .getByRole("button", { name: /^Available balance/ })
      .innerText();
    await expect(picker).toHaveText(monthText(month));
    await expect(spending).toContainText("$67.00");
    await chooseMonth(page, picker, previous);
    await expect(spending).toContainText("$125.00");
    await expect(page.getByRole("button", { name: /^Money in/ })).toContainText(
      "$2,000.00",
    );
    await expect(
      page.getByRole("button", { name: /^Available balance/ }),
    ).toHaveText(balance, { useInnerText: true });
    await choose(page, ownership, "Voytek");
    await expect(picker).toHaveText(monthText(previous));
    await expect(spending).toContainText("$75.00");
    await expect(
      page.getByRole("button", { name: /^Budget remaining/ }),
    ).toContainText("$375.00");
    await page.reload();
    await expect(picker).toHaveText(monthText(previous));
    await expect(ownership).toContainText("Voytek");
    await expect(spending).toContainText("$75.00");
    if (info.project.name === "desktop") {
      const title = (await page
        .getByRole("heading", { name: "Overview", exact: true })
        .boundingBox())!;
      for (const control of [
        picker,
        ownership,
        page.getByRole("button", { name: "Add transaction", exact: true }),
      ]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThan(title.x + title.width);
        expect(
          Math.abs(box.y + box.height / 2 - title.y - title.height / 2),
        ).toBeLessThan(2);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/overview-month-${info.project.name}.png`,
      animations: "disabled",
    });
    await spending.click();
    await expect(page).toHaveURL(
      new RegExp(`from=${previous}-01&to=${monthEnd(previous)}&owner=${owner}`),
    );
    await expect(
      page
        .getByText("Month end groceries", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.goBack();
    await page.getByRole("button", { name: /^Budget remaining/ }).click();
    await expect(page.getByLabel("Budget month")).toHaveText(
      monthText(previous),
    );
    await page.goBack();
    await chooseMonth(page, picker, month);
    await expect(ownership).toContainText("Voytek");
    await expect(spending).toContainText("$65.00");
    await page.getByRole("button", { name: /^Money in/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`from=${month}-01&to=${day}&owner=${owner}`),
    );
    for (const invalid of ["invalid", "2026-13", "9999-12"]) {
      await page.goto(`/?month=${invalid}`);
      await expect(picker).toHaveText(monthText(month));
      await expect(spending).toContainText("$67.00");
    }
  } finally {
    await db.$disconnect();
  }
});

test("expense controls sit beside their titles when space allows and remain usable on phones", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  await db.$disconnect();
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto("/expenses");
  const chart = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Expenses over time",
      exact: true,
    }),
  });
  const breakdown = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Expense breakdown",
      exact: true,
    }),
  });
  await expect(
    chart.getByRole("region", {
      name: "Expenses by category and month",
      exact: true,
    }),
  ).toBeVisible();
  if (info.project.name === "desktop") {
    for (const section of [chart, breakdown]) {
      const title = (await section.getByRole("heading").boundingBox())!;
      const buttons = await section
        .locator('button[aria-pressed], button[role="tab"]')
        .all();
      for (const button of buttons) {
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThan(title.x + title.width);
        expect(
          Math.abs(box.y + box.height / 2 - title.y - title.height / 2),
        ).toBeLessThan(2);
      }
    }
  }
  await page.screenshot({
    path: `artifacts/expense-headers-${info.project.name}.png`,
    animations: "disabled",
    fullPage: true,
  });
  await chart.getByRole("button", { name: "Day", exact: true }).click();
  await chart.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(
    chart.getByRole("table", {
      name: "Expenses by category and day",
      exact: true,
    }),
  ).toBeVisible();
  await breakdown.getByRole("tab", { name: "Account", exact: true }).click();
  await expect(
    breakdown.getByRole("button", {
      name: "View Everyday transactions",
      exact: true,
    }),
  ).toBeVisible();
  await breakdown.getByRole("tab", { name: "Person", exact: true }).click();
  await expect(
    breakdown.getByRole("button", {
      name: "View Voytek transactions",
      exact: true,
    }),
  ).toBeVisible();
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
