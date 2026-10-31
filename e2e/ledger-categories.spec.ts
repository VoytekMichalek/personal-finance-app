import type { Page } from "@playwright/test";
import { test, expect, session, database, choose } from "./fixtures";

const first = "Direct Credit 396297 IVV PAYMENT OCT26/00823316";
async function seed(page: Page, count: number) {
  await session(page);
  const db = await database();
  const accounts = await Promise.all(
    ["Everyday", "Other account"].map((name) =>
      db.account.create({
        data: {
          name,
          type: "bank",
          owner: "household",
          openingDate: "2026-01-01",
          openingBalanceCents: 100000n,
        },
      }),
    ),
  );
  const otherCategory = await db.category.findFirstOrThrow({
    where: { kind: "income", name: { not: "Salary" }, archived: false },
  });
  await db.transaction.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      accountId: accounts[index % 2].id,
      date: index === 0 ? "2026-10-31" : "2026-07-01",
      description:
        index === 0
          ? first
          : `Direct Credit 396297 IVV PAYMENT JUL26/${String(823296 + index).padStart(8, "0")}`,
      kind: "income",
      amountCents: BigInt(100 + index),
      categoryId: index === 1 ? otherCategory.id : null,
    })),
  });
  await db.transaction.create({
    data: {
      accountId: accounts[0].id,
      date: "2026-10-01",
      description: "Direct Credit 396298 IVV PAYMENT JUL26/00823296",
      kind: "income",
      amountCents: 100n,
    },
  });
  const source = await db.transaction.findFirstOrThrow({
    where: { description: first },
  });
  return { db, accounts, source };
}
const picker = (page: Page) =>
  page.getByRole("combobox", { name: "Category for " + first, exact: true });
const saved = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/transactions/remember") &&
      response.request().method() === "POST",
  );

test("remembers from the ledger, reviews 800 matches across all pages and retains highlights after reload", async ({
  page,
}, info) => {
  const { db, source } = await seed(page, 800);
  try {
    await page.goto("/transactions");
    await page
      .getByRole("searchbox", { name: "Search transactions" })
      .fill("Direct Credit 396297");
    await expect(
      page.getByRole("button", {
        name: "Select all 800 matching transactions",
      }),
    ).toBeVisible();
    const categorySaved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/transactions/bulk-category") &&
        response.request().method() === "POST",
    );
    await choose(page, picker(page), "Salary");
    expect((await categorySaved).ok()).toBe(true);
    await page
      .getByRole("button", {
        name: "Remember " + first,
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("status")).toContainText(
      "800 matching transactions",
    );
    await expect(
      dialog.getByText("799 to update · 1 already correct."),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Remembered text", { exact: true }),
    ).toHaveValue("direct credit 396297 ivv payment");
    await dialog
      .getByText("Review matching transactions (800)", { exact: true })
      .click();
    await expect(dialog.getByRole("listitem")).toHaveCount(800);
    expect(await db.rule.count()).toBe(0);
    await page.screenshot({
      path: `artifacts/remember-ledger-dialog-${info.project.name}.png`,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await db.transaction.count({ where: { categoryId: { not: null } } }),
    ).toBe(2);
    // The dedicated row action remains available after reloading.
    await page.reload();
    await page
      .getByRole("button", { name: "Remember " + first, exact: true })
      .click();
    const response = saved(page);
    await dialog
      .getByRole("button", { name: "Save rule & apply to 800", exact: true })
      .click();
    expect((await response).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    const salary = await db.category.findFirstOrThrow({
      where: { name: "Salary" },
    });
    expect(
      await db.transaction.count({ where: { categoryId: salary.id } }),
    ).toBe(800);
    expect(await db.rule.count()).toBe(1);
    expect(
      await db.transaction.findUnique({ where: { id: source.id } }),
    ).toMatchObject({ amountCents: 100n, date: "2026-10-31" });
    await page.goto("/transactions");
    await page
      .getByRole("searchbox", { name: "Search transactions" })
      .fill("Direct Credit 396297");
    await expect(
      page
        .getByText("Matches saved rule", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(50);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByText("51–100 of 800", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Matches saved rule", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(50);
    await page.reload();
    await expect(
      page
        .getByText("Matches saved rule", { exact: true })
        .filter({ visible: true }),
    ).not.toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ledger-categories-${info.project.name}.png`,
    });
    await page.goto("/categories");
    await expect(
      page.getByRole("heading", { name: "Transaction rules", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /^Contains “direct credit 396297 ivv payment”/,
      }),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});

test("ledger remembering previews pattern edits and recovers from concurrent changes @timing @ledger-timing", async ({
  page,
}) => {
  await page.clock.install();
  const { db, source } = await seed(page, 2);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.goto("/transactions");
    await page
      .getByRole("button", { name: "Remember " + first, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await choose(
      page,
      dialog.getByLabel("Category to remember", { exact: true }),
      "Salary",
    );
    const text = dialog.getByLabel("Remembered text", { exact: true });
    await text.fill(first);
    await expect(dialog.getByRole("status")).toContainText(
      "1 matching transactions",
    );
    await text.fill("direct credit 396297 ivv payment");
    await expect(dialog.getByRole("status")).toContainText(
      "2 matching transactions",
    );
    await db.transaction.update({
      where: { id: source.id },
      data: { version: { increment: 1 }, notes: "Concurrent note" },
    });
    await page.route("**/api/transactions/remember", async (route) => {
      await barrier;
      await route.continue();
    });
    const response = saved(page);
    await dialog
      .getByRole("button", { name: "Save rule & apply to 2", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Applying rule…", exact: true }),
    ).toBeDisabled();
    expect(await db.rule.count()).toBe(0);
    release();
    expect((await response).status()).toBe(409);
    await expect(dialog.getByRole("alert")).toContainText(
      "Matching transactions changed",
    );
    const recovered = saved(page);
    await dialog
      .getByRole("button", { name: "Save rule & apply to 2", exact: true })
      .click();
    expect((await recovered).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    expect(
      await db.transaction.findUnique({ where: { id: source.id } }),
    ).toMatchObject({ notes: "Concurrent note", version: 3 });
    expect(await db.rule.count()).toBe(1);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await db.$disconnect();
  }
});
