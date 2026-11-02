import { test, expect, chooseDate, choose } from "./fixtures";
import { seed, day } from "./ux-fixtures";
import { addDays, displayDate } from "../packages/shared/src/index";

test("custom calendars save transaction and schedule dates and clear optional end dates", async ({
  page,
}) => {
  const { db } = await seed(page);
  try {
    await page.goto("/transactions?new=1");
    const transaction = page.getByRole("dialog", {
      name: "Add transaction",
      exact: true,
    });
    await transaction
      .getByLabel("Description", { exact: true })
      .fill("Calendar purchase");
    await transaction.getByLabel("Amount (AUD)").fill("12.34");
    const date = transaction.getByLabel("Date", { exact: true });
    const previous = addDays(day, -1);
    await chooseDate(page, date, previous);
    await transaction
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    await expect(transaction).toBeHidden();
    expect(
      await db.transaction.findFirstOrThrow({
        where: { description: "Calendar purchase" },
      }),
    ).toMatchObject({ date: previous, amountCents: -1234n });

    await page.goto("/plan?tab=bills");
    await page
      .getByRole("button", { name: "Add schedule", exact: true })
      .click();
    const schedule = page.getByRole("dialog", {
      name: "Add a schedule",
      exact: true,
    });
    await schedule.getByLabel("Name", { exact: true }).fill("Calendar bill");
    await schedule.getByLabel("Amount (AUD)").fill("25");
    await choose(
      page,
      schedule.getByLabel("Account", { exact: true }),
      "Everyday",
    );
    await chooseDate(
      page,
      schedule.getByLabel("Starts / next renewal"),
      "2027-01-31",
    );
    const end = schedule.getByLabel("End date (optional)");
    await chooseDate(page, end, "2027-03-31");
    await schedule
      .getByRole("button", { name: "Clear end date", exact: true })
      .click();
    await expect(end).toHaveText("Choose date");
    await schedule
      .getByRole("button", { name: "Add schedule", exact: true })
      .click();
    await expect(schedule).toBeHidden();
    expect(
      await db.schedule.findFirstOrThrow({ where: { name: "Calendar bill" } }),
    ).toMatchObject({ startDate: "2027-01-31", endDate: null });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});

test("date picker keyboard dismissal restores focus without closing its form", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  await db.$disconnect();
  await page.goto("/transactions?new=1");
  const transaction = page.getByRole("dialog", {
    name: "Add transaction",
    exact: true,
  });
  const date = transaction.getByLabel("Date", { exact: true });
  await date.click();
  const calendar = page.getByRole("dialog", {
    name: "Choose date",
    exact: true,
  });
  const tomorrow = calendar.getByRole("button", {
    name: displayDate(addDays(day, 1)),
    exact: true,
  });
  if (await tomorrow.count()) await expect(tomorrow).toBeDisabled();
  await page.screenshot({
    path: `artifacts/date-calendar-${info.project.name}.png`,
    animations: "disabled",
  });
  expect(
    await calendar.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
  await expect(transaction).toBeVisible();
  await expect(date).toBeFocused();
  await expect(date).toHaveText(displayDate(day));
  await date.click();
  await calendar.getByRole("button", { name: "Today", exact: true }).click();
  await expect(calendar).toBeHidden();
  await expect(date).toBeFocused();
  await expect(transaction).toBeVisible();
});
