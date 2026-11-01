import { test, expect, choosePeriod } from "./fixtures";
import { seed } from "./ux-fixtures";

test("filters fit one desktop row and neighbouring chart controls align with accessible context", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  try {
    await page.goto("/transactions");
    const filters = page.getByRole("region", {
      name: "Transaction filters",
      exact: true,
    });
    await expect(filters.getByRole("searchbox")).toBeVisible();
    if (info.project.name === "desktop") {
      expect((await filters.boundingBox())!.height).toBeLessThan(90);
      const positions = await filters
        .locator("input, button")
        .evaluateAll((controls) =>
          controls.map((c) => c.getBoundingClientRect().y),
        );
      expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
    }
    await filters.screenshot({
      path: `artifacts/ux-filter-bar-${info.project.name}.png`,
    });
    await choosePeriod(page, "This month");
    await expect(
      filters.getByRole("button", { name: "Date range", exact: true }),
    ).toHaveText("This month");
    await page.goto("/expenses");
    const graph = page.getByRole("tab", { name: "Graph", exact: true });
    const category = page.getByRole("tab", { name: "Category", exact: true });
    await expect(graph).toBeVisible();
    if (info.project.name === "desktop") {
      expect((await graph.boundingBox())!.y).toBeCloseTo(
        (await category.boundingBox())!.y,
        0,
      );
      expect((await graph.boundingBox())!.x).toBeGreaterThan(
        (await page
          .getByRole("button", { name: "Day", exact: true })
          .boundingBox())!.x,
      );
    }
    await page
      .getByRole("button", { name: "About Expenses over time", exact: true })
      .focus();
    await expect(page.getByRole("tooltip")).toContainText("refunds");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page
      .getByRole("button", { name: "About Expense breakdown", exact: true })
      .click();
    await expect(page.getByRole("tooltip")).toContainText("selected dates");
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ux-expenses-aligned-${info.project.name}.png`,
      animations: "disabled",
    });
    await page.goto("/net-worth");
    const switcher = page.getByRole("tablist", {
      name: "Chart view",
      exact: true,
    });
    await expect(switcher).toBeVisible();
    const switchBox = (await switcher.boundingBox())!;
    const toolbarBox = (await switcher.locator("..").boundingBox())!;
    expect(switchBox.x + switchBox.width).toBeCloseTo(
      toolbarBox.x + toolbarBox.width,
      0,
    );
    if (info.project.name === "desktop") {
      const periods = page.getByRole("button", {
        name: "1 month",
        exact: true,
      });
      await expect(graph).toBeVisible();
      expect((await graph.boundingBox())!.y).toBeCloseTo(
        (await periods.boundingBox())!.y,
        0,
      );
      expect((await graph.boundingBox())!.x).toBeGreaterThan(
        (await periods.boundingBox())!.x,
      );
    }
    await switcher.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/ux-net-worth-aligned-${info.project.name}.png`,
      animations: "disabled",
    });
  } finally {
    await db.$disconnect();
  }
});

test("one action assigns every category a saved unique colour and Undo restores the previous palette", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  try {
    const before = await db.category.findMany({ orderBy: { id: "asc" } });
    await db.category.update({
      where: { id: before[0].id },
      data: { archived: true },
    });
    await page.goto("/categories");
    await page
      .getByRole("searchbox", { name: "Search categories" })
      .fill("Groceries");
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/categories/colours") &&
        r.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Assign unique colours", exact: true })
      .click();
    expect((await saved).ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Undo colours", exact: true }),
    ).toBeVisible();
    const assigned = await db.category.findMany({ orderBy: { id: "asc" } });
    expect(new Set(assigned.map((c) => c.color)).size).toBe(before.length);
    expect(assigned[0].archived).toBe(true);
    const restored = page.waitForResponse(
      (r) =>
        r.url().endsWith("/categories/colours") &&
        r.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Undo colours", exact: true })
      .click();
    expect((await restored).ok()).toBe(true);
    expect(
      (await db.category.findMany({ orderBy: { id: "asc" } })).map(
        (c) => c.color,
      ),
    ).toEqual(before.map((c) => c.color));
    await page
      .getByRole("button", { name: "Assign unique colours", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Undo colours", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Assign unique colours", exact: true }),
    ).toBeVisible();
    expect(
      new Set((await db.category.findMany()).map((c) => c.color)).size,
    ).toBe(before.length);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ux-category-colours-${info.project.name}.png`,
      animations: "disabled",
    });
  } finally {
    await db.$disconnect();
  }
});

test("date range opens beside its left-aligned trigger and supports presets, nested calendars and cancelling drafts @timing @date-popover-timing", async ({
  page,
}, info) => {
  const { db } = await seed(page);
  try {
    await page.goto("/transactions");
    const trigger = page.getByRole("button", {
      name: "Date range",
      exact: true,
    });
    await expect(trigger.locator("span")).toHaveCSS("text-align", "left");
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Date range", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
    const anchor = (await trigger.boundingBox())!;
    const popup = (await panel.boundingBox())!;
    // Small viewports can flip above the trigger to keep the whole panel reachable.
    if ((await panel.getAttribute("data-side")) === "top")
      expect(popup.y + popup.height).toBeCloseTo(anchor.y - 8, 0);
    else expect(popup.y).toBeCloseTo(anchor.y + anchor.height + 8, 0);
    if (info.project.name === "desktop")
      expect(popup.x).toBeCloseTo(anchor.x, 0);
    expect(popup.x).toBeGreaterThanOrEqual(12);
    expect(popup.x + popup.width).toBeLessThanOrEqual(
      page.viewportSize()!.width - 12,
    );
    await page.screenshot({
      path: `artifacts/ux-date-popover-${info.project.name}.png`,
      animations: "disabled",
    });
    await panel.getByRole("button", { name: "From date", exact: true }).click();
    const calendar = page.getByRole("dialog", {
      name: "Choose date",
      exact: true,
    });
    await expect(calendar).toBeVisible();
    await expect(calendar).not.toHaveAttribute("aria-modal", "true");
    await calendar.getByRole("button", { name: "Today", exact: true }).click();
    await expect(calendar).toBeHidden();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText("All history");
    await expect(page).toHaveURL(/\/transactions$/);
    await trigger.click();
    await panel
      .getByRole("button", { name: "This month", exact: true })
      .click();
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveText("This month");
    await trigger.click();
    // The panel can cover the page heading after flipping above on phones.
    await page.mouse.click(2, 2);
    await expect(panel).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});
