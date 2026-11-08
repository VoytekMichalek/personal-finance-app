import { test, expect, session, database, choose } from "./fixtures";

test("institution defaults and per-account customisation survive reload on desktop and mobile", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "Everyday savings",
        institution: "CBA",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 123456n,
      },
    });
    await db.account.createMany({
      data: [
        {
          name: "Rainy day",
          institution: "BOQ",
          type: "bank",
          openingDate: "2026-01-01",
          openingBalanceCents: 500000n,
        },
        {
          name: "Spending",
          institution: "Up",
          type: "bank",
          openingDate: "2026-01-01",
          openingBalanceCents: 45000n,
        },
        {
          name: "Travel card",
          institution: "Westpac",
          type: "credit",
          openingDate: "2026-01-01",
          openingBalanceCents: -42500n,
        },
      ],
    });
    await page.goto("/accounts");
    const card = page.getByRole("button", {
      name: "Open account: Everyday savings",
      exact: true,
    });
    await expect(
      card.getByRole("img", { name: "CommBank logo" }),
    ).toBeVisible();
    await expect(card).toContainText("$1,234.56");
    await expect(
      page.getByRole("button", {
        name: "Open account: Travel card",
        exact: true,
      }),
    ).toContainText("Amount owed$425.00");
    await page.screenshot({
      path: `artifacts/account-branding-${info.project.name}.png`,
      fullPage: true,
    });
    await card
      .locator("..")
      .getByRole("button", { name: "Edit appearance", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Account details",
      exact: true,
    });
    await expect(
      dialog.getByLabel("Card colour", { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel("Card colour", { exact: true }).fill("#225588");
    await choose(
      page,
      dialog.getByRole("combobox", { name: "Icon", exact: true }),
      "Savings",
    );
    await dialog
      .getByLabel("Subtle background tint", { exact: true })
      .uncheck();
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(card).toBeVisible();
    await expect(card.getByRole("img")).toHaveCount(0);
    expect(
      await card.evaluate((e) => getComputedStyle(e).backgroundImage),
    ).toBe("none");
    expect(
      (await db.account.findUniqueOrThrow({ where: { id: account.id } }))
        .appearance,
    ).toMatchObject({ color: "#225588", icon: "piggy-bank", tint: false });
    await card
      .locator("..")
      .getByRole("button", { name: "Edit appearance", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Use institution defaults", exact: true })
      .click();
    await expect(
      dialog.getByRole("img", { name: "CommBank logo" }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Subtle background tint", { exact: true }),
    ).toBeChecked();
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      card.getByRole("img", { name: "CommBank logo" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});

test("custom institution logo upload keeps edits through failure and can be reused @timing", async ({
  page,
}, info) => {
  await session(page);
  // Image decoding and database writes use real completion, not browser timers.
  const db = await database();
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/accounts", async (route) => {
    if (route.request().method() === "POST" && fail) {
      fail = false;
      await barrier;
      await route.fulfill({
        status: 503,
        json: {
          error:
            "Could not save this account. Try saving again; your edits are still here.",
        },
      });
    } else await route.continue();
  });
  try {
    await page.goto("/accounts");
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Add an account",
      exact: true,
    });
    await dialog
      .getByLabel("Account name", { exact: true })
      .fill("Community savings");
    await dialog
      .getByLabel("Institution name", { exact: true })
      .fill("Community Credit Union");
    await dialog.locator("summary").filter({ hasText: "Appearance" }).click();
    await dialog.getByLabel("Card colour", { exact: true }).fill("#228855");
    await dialog
      .getByLabel("Upload logo", { exact: true })
      .setInputFiles({
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      });
    await expect(dialog.getByRole("alert")).toContainText(
      "Choose a PNG, JPEG or WebP",
    );
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#228855";
      context.fillRect(0, 0, 32, 32);
      return canvas.toDataURL("image/png").split(",")[1]!;
    });
    await dialog
      .getByLabel("Upload logo", { exact: true })
      .setInputFiles({
        name: "community.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
    await expect(
      dialog.getByRole("img", { name: "Community Credit Union logo" }),
    ).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText(
      "PNG, JPEG or WebP · up to 2 MB",
    );
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog
      .getByLabel("Save as a reusable institution", { exact: false })
      .check();
    await page.screenshot({
      path: `artifacts/account-appearance-${info.project.name}.png`,
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Saving…", exact: true }),
    ).toBeDisabled();
    release();
    await expect(dialog.getByRole("alert")).toContainText("Try saving again");
    await expect(
      dialog.getByLabel("Account name", { exact: true }),
    ).toHaveValue("Community savings");
    await expect(
      dialog.getByRole("img", { name: "Community Credit Union logo" }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(
      page
        .getByRole("button", {
          name: "Open account: Community savings",
          exact: true,
        })
        .getByRole("img"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    await dialog
      .getByLabel("Account name", { exact: true })
      .fill("Community spending");
    await choose(
      page,
      dialog.getByRole("combobox", {
        name: "Bank or institution",
        exact: true,
      }),
      "Community Credit Union · custom",
    );
    await dialog
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    const saved = await db.account.findMany();
    expect(saved).toHaveLength(2);
    expect(new Set(saved.map((a) => a.customInstitutionId)).size).toBe(1);
    expect(await db.institution.count()).toBe(1);
    await expect(
      page
        .getByRole("button", {
          name: "Open account: Community spending",
          exact: true,
        })
        .getByRole("img"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await db.$disconnect();
  }
});
