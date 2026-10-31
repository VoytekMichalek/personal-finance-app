import type { Page } from "@playwright/test";
import { test, expect, session, database, choose } from "./fixtures";

async function seed(page: Page, withPeer = false) {
  await session(page);
  const db = await database();
  const accounts = await Promise.all(
    ["Everyday", "Savings"].map((name) =>
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
  const category = await db.category.findFirstOrThrow({
    where: { name: "Dining" },
  });
  const row = await db.transaction.create({
    data: {
      accountId: accounts[0].id,
      owner: "household",
      date: "2026-10-01",
      kind: "expense",
      amountCents: -12500n,
      description: "Bank payment",
      categoryId: category.id,
      notes: "Original details",
    },
  });
  const peer = withPeer
    ? await db.transaction.create({
        data: {
          accountId: accounts[1].id,
          owner: "household",
          date: row.date,
          kind: "income",
          amountCents: 12500n,
          description: "Incoming bank payment",
        },
      })
    : undefined;
  return { db, accounts, row, peer };
}
const typePicker = (page: Page) =>
  page.getByRole("combobox", { name: "Type for Bank payment", exact: true });
const categoryPicker = (page: Page) =>
  page.getByRole("combobox", {
    name: "Category for Bank payment",
    exact: true,
  });
const savedType = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/type") && response.request().method() === "PUT",
  );

test("inline type bubbles link existing payments and keep both rows when unlinked", async ({
  page,
}, info) => {
  const { db, accounts, row, peer } = await seed(page, true);
  try {
    await page.goto("/transactions");
    await expect(typePicker(page)).toHaveText("Expense");
    await choose(page, typePicker(page), "Transfer");
    await choose(
      page,
      page.getByLabel("Other account for Bank payment", { exact: true }),
      "Savings",
    );
    await expect(
      page.getByRole("button", { name: "Save type", exact: true }),
    ).toBeDisabled();
    await choose(
      page,
      page.getByLabel("Matching payment for Bank payment", { exact: true }),
      "Incoming bank payment · $125.00",
    );
    const saved = savedType(page);
    await page.getByRole("button", { name: "Save type", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(typePicker(page)).toHaveText("Transfer");
    await expect(categoryPicker(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await db.transaction.count()).toBe(2);
    const stored = await db.transaction.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(stored).toMatchObject({
      notes: "Original details",
      amountCents: -12500n,
    });
    expect(
      (await db.transaction.findUniqueOrThrow({ where: { id: peer!.id } }))
        .transferGroupId,
    ).toBe(stored.transferGroupId);
    await page.goto("/accounts/" + accounts[0].id);
    await choose(page, typePicker(page), "Expense");
    await expect(
      page.getByText("Keep both payments and unlink them.", { exact: false }),
    ).toBeVisible();
    const unlinked = savedType(page);
    await page.getByRole("button", { name: "Save type", exact: true }).click();
    expect((await unlinked).ok()).toBe(true);
    await expect(typePicker(page)).toHaveText("Expense");
    await expect(categoryPicker(page)).toHaveText("Uncategorised");
    await page.reload();
    await expect(typePicker(page)).toHaveText("Expense");
    expect(await db.transaction.count()).toBe(2);
    expect(
      await db.transaction.findUnique({ where: { id: peer!.id } }),
    ).toMatchObject({ kind: "income", transferGroupId: null });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/inline-types-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await db.$disconnect();
  }
});

test("inline type changes save regular types and create a confirmed opposite transfer entry", async ({
  page,
}) => {
  const { db, accounts, row } = await seed(page);
  try {
    await page.goto("/accounts/" + accounts[0].id);
    const refund = savedType(page);
    await choose(page, typePicker(page), "Refund");
    expect((await refund).ok()).toBe(true);
    await expect(categoryPicker(page)).toHaveText("Dining");
    const expense = savedType(page);
    await choose(page, typePicker(page), "Expense");
    expect((await expense).ok()).toBe(true);
    await choose(page, typePicker(page), "Transfer");
    await choose(
      page,
      page.getByLabel("Other account for Bank payment", { exact: true }),
      "Savings",
    );
    await expect(
      page.getByText("Creates the opposite entry", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(typePicker(page)).toHaveText("Expense");
    expect(await db.transaction.count()).toBe(1);
    await choose(page, typePicker(page), "Transfer");
    await choose(
      page,
      page.getByLabel("Other account for Bank payment", { exact: true }),
      "Savings",
    );
    const saved = savedType(page);
    await page.getByRole("button", { name: "Save type", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(typePicker(page)).toHaveText("Transfer");
    const pair = await db.transaction.findMany();
    expect(pair).toHaveLength(2);
    expect(pair.reduce((total, item) => total + item.amountCents, 0n)).toBe(0n);
    expect(pair.find((item) => item.id === row.id)?.amountCents).toBe(-12500n);
  } finally {
    await db.$disconnect();
  }
});

test("inline type pending state disables category edits and recovers after a stale write @timing @type-timing", async ({
  page,
}) => {
  await page.clock.install();
  const { db, row } = await seed(page);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.goto("/transactions");
    await expect(typePicker(page)).toHaveText("Expense");
    await db.transaction.update({
      where: { id: row.id },
      data: { version: { increment: 1 } },
    });
    await page.route("**/api/transactions/*/type", async (route) => {
      await barrier;
      await route.continue();
    });
    const rejected = savedType(page);
    await choose(page, typePicker(page), "Refund");
    await expect(typePicker(page)).toBeDisabled();
    await expect(categoryPicker(page)).toBeDisabled();
    await expect(
      page.getByRole("status").filter({ hasText: "Saving type…" }),
    ).toBeVisible();
    release();
    expect((await rejected).status()).toBe(409);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "This transaction or its linked payment changed" }),
    ).toBeVisible();
    await expect(typePicker(page)).toBeEnabled();
    await expect(typePicker(page)).toHaveText("Expense");
    const recovered = savedType(page);
    await choose(page, typePicker(page), "Refund");
    expect((await recovered).ok()).toBe(true);
    await expect(typePicker(page)).toHaveText("Refund");
    await expect(categoryPicker(page)).toBeEnabled();
    expect(
      await db.transaction.findUnique({ where: { id: row.id } }),
    ).toMatchObject({ kind: "refund", version: 3, amountCents: 12500n });
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await db.$disconnect();
  }
});
