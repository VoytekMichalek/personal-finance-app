import { randomUUID } from "node:crypto";
import { test, expect, session, database, choose } from "./fixtures";

test("branded account cards distinguish owners, filter consistently and open editable account details", async ({
  page,
}, info) => {
  const owner = await session(page);
  const db = await database();
  try {
    const nicola = await db.user.create({
      data: {
        id: randomUUID(),
        name: "Nicola",
        email: "nicola@example.test",
        role: "member",
        state: "invited",
      },
    });
    const owners = [owner, nicola.id, "household"];
    const accounts = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        db.account.create({
          data: {
            name:
              index === 8
                ? "A longer household emergency savings account name"
                : `Sample account ${index + 1}`,
            type:
              index % 4 === 2 ? "credit" : index % 4 === 3 ? "cash" : "bank",
            owner: owners[Math.floor(index / 4)],
            institution: "Example bank",
            openingDate: "2026-01-01",
            openingBalanceCents: index % 4 === 2 ? -42500n : 100000n,
            archived: index === 11,
          },
        }),
      ),
    );
    await db.transaction.create({
      data: {
        accountId: accounts[0].id,
        owner,
        date: "2026-01-05",
        description: "Card balance check",
        kind: "expense",
        amountCents: -2500n,
      },
    });
    await page.goto("/accounts");
    const cards = page.getByRole("list", { name: "Accounts", exact: true });
    const buttons = cards.getByRole("button", { name: /^Open account:/ });
    await expect(buttons).toHaveCount(11);
    const card = (name: string) =>
      buttons.filter({ has: page.getByText(name, { exact: true }) });
    const first = card("Sample account 1");
    await expect(first).toContainText("$975.00");
    await expect(first).toContainText("Last recorded transaction: 5 Jan 2026");
    await expect(card("Sample account 2")).toContainText(
      "No transactions recorded",
    );
    await expect(buttons.filter({ hasText: "Sample account 3" })).toContainText(
      "Amount owed$425.00",
    );
    const colour = (name: string, person: string) =>
      card(name)
        .getByLabel(`Owner: ${person}`, { exact: true })
        .locator('[aria-hidden="true"]')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    const voytekColour = await colour("Sample account 1", "Voytek");
    const nicolaColour = await colour("Sample account 5", "Nicola");
    const householdColour = await colour("Sample account 10", "Household");
    expect(new Set([voytekColour, nicolaColour, householdColour]).size).toBe(3);
    expect(await colour("Sample account 2", "Voytek")).toBe(voytekColour);
    expect(await colour("Sample account 6", "Nicola")).toBe(nicolaColour);
    expect(
      await first.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe("rgb(255, 255, 255)");
    const boxes = await buttons.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    if (info.project.name === "desktop") {
      expect(
        boxes.filter((box) => Math.abs(box.y - boxes[0].y) < 1).length,
      ).toBeGreaterThanOrEqual(4);
      expect(Math.max(...boxes.map((box) => box.height))).toBeLessThanOrEqual(
        280,
      );
    } else {
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
      expect(Math.max(...boxes.map((box) => box.height))).toBeLessThanOrEqual(
        280,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/account-cards-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const filter = page.getByRole("combobox", {
      name: "Ownership filter",
      exact: true,
    });
    await filter.click();
    const nicolaOption = page.getByRole("option", {
      name: "Nicola",
      exact: true,
    });
    await expect(nicolaOption).toBeVisible();
    expect(
      await nicolaOption
        .locator('span[aria-hidden="true"]')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe(nicolaColour);
    await nicolaOption.click();
    await expect(buttons).toHaveCount(4);
    expect(await colour("Sample account 5", "Nicola")).toBe(nicolaColour);
    await choose(page, filter, "Household");
    await expect(buttons).toHaveCount(3);
    const archived = page.getByLabel("Show archived", { exact: true });
    // The URL-backed filter commits through React Router's transition.
    await archived.click();
    await expect(archived).toBeChecked();
    await expect(buttons).toHaveCount(4);
    await expect(
      buttons.filter({ hasText: "Sample account 12" }),
    ).toContainText("Archived");
    await choose(page, filter, "Voytek");
    await first.click();
    await expect(
      page.getByRole("heading", { name: "Sample account 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Last recorded transaction: 5 Jan 2026", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Import transactions", exact: true })
      .click();
    const importDialog = page.getByRole("dialog", {
      name: "Import transactions",
      exact: true,
    });
    await expect(importDialog).toContainText(
      "Last recorded transaction: 5 Jan 2026",
    );
    await importDialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit account", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Account details",
      exact: true,
    });
    await dialog
      .getByLabel("Account name", { exact: true })
      .fill("Renamed sample account");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.goto("/accounts");
    await expect(
      cards.getByRole("button", { name: /Renamed sample account/ }),
    ).toContainText("$975.00");
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: accounts[0].id } }))
        .name,
    ).toBe("Renamed sample account");
  } finally {
    await db.$disconnect();
  }
});
