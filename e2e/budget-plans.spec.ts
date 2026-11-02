import { test, expect, choose, chooseMonth, monthText } from "./fixtures";
import { seed, month } from "./ux-fixtures";
import { shiftMonth } from "../packages/shared/src/index";

test("finite budget plans preserve first-month overrides, recover failed saves and restore the plan", async ({
  page,
}, info) => {
  const { db, food } = await seed(page);
  const start = "2026-11";
  try {
    await page.goto(`/plan?month=${start}`);
    await page.getByRole("button", { name: "Set budget", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Set monthly budget",
      exact: true,
    });
    await choose(
      page,
      dialog.getByLabel("Category", { exact: true }),
      "Groceries",
    );
    await dialog.getByLabel("Allowance (AUD)").fill("500");
    await expect(dialog.getByLabel("Repeat monthly")).not.toBeChecked();
    await expect(dialog.getByLabel("Number of months")).toBeHidden();
    await dialog.getByLabel("Repeat monthly").check();
    await dialog.getByLabel("Number of months").fill("3");
    await expect(
      dialog.getByText(
        "November 2026 – January 2027. Includes the starting month.",
      ),
    ).toBeVisible();
    await dialog.getByLabel("Month", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "November 2026", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: `artifacts/budget-month-picker-${info.project.name}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(dialog.getByLabel("Month", { exact: true })).toBeFocused();
    await dialog
      .getByRole("button", { name: "Save budget", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    const amount = page.getByRole("button", {
      name: "Edit Groceries budget",
      exact: true,
    });
    await expect(amount).toHaveText("Budget $500.00", { useInnerText: false });
    expect(await db.budget.findFirstOrThrow()).toMatchObject({
      month: start,
      endMonth: "2027-01",
      amountCents: 50000n,
    });
    await amount.click();
    const input = page.getByLabel("Groceries budget amount");
    await input.fill("650");
    await page.route("**/api/budgets/overrides", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Budget save failed. Try again." }),
      }),
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Budget save failed" }),
    ).toBeVisible();
    await expect(input).toHaveValue("650");
    await page.unroute("**/api/budgets/overrides");
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await expect(amount).toContainText("$650.00");
    await expect(
      page.getByText("Overridden for this month", { exact: true }),
    ).toBeVisible();
    expect(await db.budget.findFirstOrThrow()).toMatchObject({
      amountCents: 50000n,
      endMonth: "2027-01",
    });
    expect(await db.budgetOverride.findFirstOrThrow()).toMatchObject({
      categoryId: food.id,
      month: start,
      amountCents: 65000n,
    });
    await page.reload();
    await expect(amount).toContainText("$650.00");
    await page.screenshot({
      path: `artifacts/budget-override-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const picker = page.getByLabel("Budget month");
    for (const next of ["2026-12", "2027-01"]) {
      await chooseMonth(page, picker, next);
      await expect(amount).toContainText("$500.00");
      await expect(
        page.getByRole("button", { name: "Restore Groceries planned amount" }),
      ).toBeHidden();
    }
    await chooseMonth(page, picker, "2027-02");
    await expect(
      page.getByRole("heading", { name: "Set your first budget", exact: true }),
    ).toBeVisible();
    await chooseMonth(page, picker, start);
    await page
      .getByRole("button", { name: "Restore Groceries planned amount" })
      .click();
    await expect(amount).toContainText("$500.00");
    await expect(
      page.getByText("Repeats through January 2027", { exact: true }),
    ).toBeVisible();
    expect(await db.budgetOverride.count()).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});

test("turning repeat off saves one month even after clearing the count", async ({
  page,
}) => {
  const { db } = await seed(page);
  try {
    await page.goto(`/plan?month=${month}`);
    await page.getByRole("button", { name: "Set budget", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Set monthly budget",
      exact: true,
    });
    await choose(
      page,
      dialog.getByLabel("Category", { exact: true }),
      "Groceries",
    );
    await dialog.getByLabel("Allowance (AUD)").fill("250");
    await dialog.getByLabel("Repeat monthly").check();
    await dialog.getByLabel("Number of months").fill("");
    await dialog.getByLabel("Repeat monthly").uncheck();
    await dialog
      .getByRole("button", { name: "Save budget", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("This month only", { exact: true }),
    ).toBeVisible();
    expect(await db.budget.findFirstOrThrow()).toMatchObject({
      month,
      endMonth: month,
    });
    await chooseMonth(
      page,
      page.getByLabel("Budget month"),
      shiftMonth(month, 1),
    );
    await expect(
      page.getByRole("heading", { name: "Set your first budget", exact: true }),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});

test("month picker supports keyboard selection, bounds and focus restoration", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  await db.$disconnect();
  await page.goto(`/?month=${month}`);
  const trigger = page.getByLabel("Overview month");
  await trigger.click();
  const picker = page.getByRole("dialog", {
    name: "Choose month",
    exact: true,
  });
  await expect(
    picker.getByRole("button", { name: "Next year" }),
  ).toBeDisabled();
  const selected = picker.getByRole("button", {
    name: monthText(month),
    exact: true,
  });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  // No timers are involved: selection/close/focus are observable Radix transitions.
  const previous = shiftMonth(month, -1);
  if (previous.slice(0, 4) === month.slice(0, 4)) {
    await selected.focus();
    await selected.press("ArrowLeft");
    await expect(
      picker.getByRole("button", { name: monthText(previous), exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(picker).toBeHidden();
    await expect(trigger).toHaveText(monthText(previous));
    if (info.project.name === "desktop") await expect(trigger).toBeFocused();
  } else {
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
  }
  await trigger.click();
  await picker.getByRole("button", { name: "This month", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(trigger).toHaveText(monthText(month));
});
