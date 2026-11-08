import { test, expect, session, database, choose } from "./fixtures";

test("saved category rules repair uncategorised ledger matches across accounts after reviewing stale data", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const accounts = await Promise.all(
      ["Everyday", "Other account"].map((name) =>
        db.account.create({
          data: {
            name,
            type: "bank",
            openingDate: "2026-01-01",
            openingBalanceCents: 0n,
            owner: "household",
          },
        }),
      ),
    );
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    const groceries = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    await db.rule.create({
      data: {
        pattern: "Local shop",
        matchMode: "contains",
        categoryId: dining.id,
      },
    });
    const rows = await Promise.all(
      Array.from({ length: 23 }, (_, i) =>
        db.transaction.create({
          data: {
            accountId: accounts[i % 2]!.id,
            date: "2026-10-01",
            description: `Local shop ${i + 1}`,
            kind: "expense",
            amountCents: -100n,
            owner: "household",
            categoryId: i === 22 ? groceries.id : null,
          },
        }),
      ),
    );
    await page.goto("/categories?tab=rules");
    await page
      .getByRole("button", { name: "Apply saved rules", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Apply saved category rules",
    });
    await expect(dialog).toContainText(
      "22 uncategorised transactions match saved rules.",
    );
    await expect(
      dialog.getByRole("list", { name: "Rule matches" }).getByRole("listitem"),
    ).toHaveCount(20);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("listitem")).toHaveCount(2);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(
      await db.transaction.count({ where: { categoryId: dining.id } }),
    ).toBe(0);
    await page
      .getByRole("button", { name: "Apply saved rules", exact: true })
      .click();
    await db.transaction.update({
      where: { id: rows[0]!.id },
      data: { categoryId: groceries.id, version: { increment: 1 } },
    });
    const stale = page.waitForResponse((response) =>
      response.url().endsWith("/api/rules/apply-categories"),
    );
    await dialog
      .getByRole("button", { name: "Apply to 22 transactions", exact: true })
      .click();
    expect((await stale).status()).toBe(409);
    await expect(dialog.getByRole("alert")).toContainText("Refresh data");
    expect(
      await db.transaction.count({ where: { categoryId: dining.id } }),
    ).toBe(0);
    await dialog
      .getByRole("button", { name: "Refresh data", exact: true })
      .click();
    await expect(dialog).toContainText(
      "21 uncategorised transactions match saved rules.",
    );
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/apply-saved-rules-${info.project.name}.png`,
      animations: "disabled",
    });
    const applied = page.waitForResponse((response) =>
      response.url().endsWith("/api/rules/apply-categories"),
    );
    await dialog
      .getByRole("button", { name: "Apply to 21 transactions", exact: true })
      .click();
    expect((await applied).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    expect(
      await db.transaction.count({ where: { categoryId: dining.id } }),
    ).toBe(21);
    expect(
      await db.transaction.count({ where: { categoryId: groceries.id } }),
    ).toBe(2);
    expect(await db.transaction.count()).toBe(23);
    await page.reload();
    await page
      .getByRole("button", { name: "Apply saved rules", exact: true })
      .click();
    await expect(dialog).toContainText(
      "0 uncategorised transactions match saved rules.",
    );
    await expect(
      dialog.getByRole("button", {
        name: "Apply to 0 transactions",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    await db.$disconnect();
  }
});

test("new entries suggest saved categories while keeping an explicit uncategorised choice", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "Rule account",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
        owner: "household",
      },
    });
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    await db.rule.create({
      data: { pattern: "Local shop", categoryId: dining.id },
    });
    await page.goto("/accounts/" + account.id);
    for (const explicit of [false, true]) {
      await page
        .getByRole("button", { name: "Add transaction", exact: true })
        .click();
      const form = page.getByRole("dialog", {
        name: "Add transaction",
        exact: true,
      });
      await form.getByLabel("Description", { exact: true }).fill("Local shop");
      await expect(form.getByLabel("Category", { exact: true })).toHaveText(
        "Dining",
      );
      await form
        .getByLabel("Amount (AUD)", { exact: true })
        .fill(explicit ? "2" : "1");
      if (explicit)
        await choose(
          page,
          form.getByLabel("Category", { exact: true }),
          "Uncategorised",
        );
      await form
        .getByRole("button", { name: "Add transaction", exact: true })
        .click();
      await expect(form).toBeHidden();
    }
    const rows = await db.transaction.findMany({
      orderBy: { amountCents: "desc" },
    });
    expect(rows.map((row) => row.categoryId)).toEqual([dining.id, null]);
    await expect(page.getByText(/Last recorded transaction:/)).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});

test("CSV type corrections recheck rules and keep manual choices through approval", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "CSV rules",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
        owner: "household",
      },
    });
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    await db.rule.create({
      data: { pattern: "Local shop", categoryId: dining.id },
    });
    await page.goto("/imports?account=" + account.id);
    await expect(
      page.getByText("No transactions recorded", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Choose bank CSV").setInputFiles({
      name: "refunds.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date,Description,Amount\n2026-10-01,Local shop,10.00\n2026-09-01,Local shop,-20.00",
      ),
    });
    await page
      .getByRole("button", { name: "Review transactions", exact: true })
      .click();
    await choose(
      page,
      page.getByLabel("Type row 1", { exact: true }),
      "Refund",
    );
    await expect(page.getByLabel("Category row 1", { exact: true })).toHaveText(
      "Dining",
    );
    await choose(
      page,
      page.getByLabel("Category row 2", { exact: true }),
      "Uncategorised",
    );
    await expect(page.getByLabel("Category row 2", { exact: true })).toHaveText(
      "Uncategorised",
    );
    await page
      .getByRole("button", { name: "Approve & import (2)", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    const rows = await db.transaction.findMany({
      orderBy: { sourceRow: "asc" },
    });
    expect(rows.map((row) => [row.kind, row.categoryId])).toEqual([
      ["refund", dining.id],
      ["expense", null],
    ]);
    await expect(
      page.getByText("Last recorded transaction: 1 Oct 2026", { exact: true }),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
