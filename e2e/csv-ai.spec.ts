import { test, expect, session, database } from "./fixtures";

test("large CSV AI batches retain every source row and resume after failure @timing", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const account = await db.account.create({
      data: {
        name: "CSV account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const category = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    await page.route("**/api/integrations", (route) =>
      route.fulfill({
        json: { openrouterConfigured: true, modelId: "fixture" },
      }),
    );
    let failed = 0,
      held = false;
    const batches: number[][] = [];
    await page.route("**/api/imports/suggest", async (route) => {
      const input = route.request().postDataJSON() as {
        rows: { rowNumber: number }[];
      };
      batches.push(input.rows.map((row) => row.rowNumber));
      expect(input.rows.length).toBeLessThanOrEqual(25);
      if (!held) {
        held = true;
        await barrier;
      }
      if (input.rows[0]!.rowNumber === 26 && failed < 2) {
        failed++;
        await route.fulfill({
          status: 502,
          json: { error: "AI suggestions did not match the expected format." },
        });
      } else
        await route.fulfill({
          json: {
            categories: input.rows.map((row) => ({
              rowNumber: row.rowNumber,
              categoryId: category.id,
            })),
          },
        });
    });
    await page.goto("/imports?account=" + account.id);
    const csv =
      "Date,Description,Amount,Balance\n" +
      Array.from(
        { length: 620 },
        (_, index) =>
          `2026-10-01,Synthetic purchase ${index},-1.01,${((100000 - (index + 1) * 101) / 100).toFixed(2)}`,
      ).join("\n");
    await page.getByLabel("Choose bank CSV").setInputFiles({
      name: "synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Review transactions" }).click();
    await expect(
      page.getByText("620 source rows · 620 selected · 0 excluded"),
    ).toBeVisible();
    await expect(
      page.getByText("The selected import reconciles", { exact: false }),
    ).toBeVisible();
    const started = page.waitForRequest((request) =>
      request.url().endsWith("/imports/suggest"),
    );
    await page
      .getByRole("button", { name: "Suggest categories", exact: true })
      .click();
    await started;
    await expect(
      page.getByRole("status").filter({ hasText: "AI checked 0 of 620" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Suggesting categories…", exact: true }),
    ).toBeDisabled();
    release();
    await expect(page.getByRole("alert")).toContainText(
      "All 620 source rows are still in the review",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "AI checked 25 of 620" }),
    ).toBeVisible();
    await expect(page.getByLabel("Category row 1", { exact: true })).toHaveText(
      "Groceries",
    );
    await page
      .getByRole("button", { name: "Retry suggestions", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "AI checked 595 of 595" }),
    ).toBeVisible();
    expect(batches.filter((batch) => batch[0] === 1)).toHaveLength(1);
    expect(new Set(batches.flat()).size).toBe(620);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Approve & import (620)" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Approve & import (620)" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    expect(
      await db.transaction.count({
        where: {
          accountId: account.id,
          categoryId: category.id,
          amountCents: -101n,
          date: "2026-10-01",
        },
      }),
    ).toBe(620);
    expect(await db.transaction.count()).toBe(620);
  } finally {
    release();
    await db.$disconnect();
  }
});

test("CSV balance review identifies missing history and updates selected totals", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "Gap account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    await page.goto("/imports?account=" + account.id);
    await page.getByLabel("Choose bank CSV").setInputFiles({
      name: "synthetic-gap.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "14/03/2026,-10,Synthetic first,490\n15/03/2026,-5,Synthetic second,485\n16/03/2026,20,Synthetic third,505",
      ),
    });
    await expect(page.getByLabel("Running balance (optional)")).toHaveText(
      "Column 4",
    );
    await page.getByRole("button", { name: "Review transactions" }).click();
    await expect(
      page.getByText("This file does not include earlier activity", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      "Balance difference: $500.00",
    );
    await expect(
      page.getByRole("button", { name: "Approve & import (3)" }),
    ).toBeDisabled();
    const acknowledge = page.getByLabel(
      "I have checked the balance difference",
      { exact: false },
    );
    await acknowledge.check();
    await expect(
      page.getByRole("button", { name: "Approve & import (3)" }),
    ).toBeEnabled();
    await page.getByLabel("Include row 1").uncheck();
    await expect(acknowledge).not.toBeChecked();
    await expect(page.getByRole("alert")).toContainText(
      "Balance difference: $510.00",
    );
    expect(await db.transaction.count()).toBe(0);
  } finally {
    await db.$disconnect();
  }
});
