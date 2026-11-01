import { test, expect, session, database, choose } from "./fixtures";
import {
  statementPdf,
  sixMonthStatement,
} from "../apps/api/src/integration/statement-fixture";

test("statement suggestions choose transfer direction before and after import and remain editable in Plan", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const source = await db.account.create({
      data: {
        name: "Statement account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Other household account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    await page.goto(`/accounts/${source.id}/statement`);
    await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
      name: "recurring-transfers.pdf",
      mimeType: "application/pdf",
      buffer: statementPdf(sixMonthStatement()),
    });
    await expect(
      page.getByText("6 pages read · 12 transaction lines", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "3. Recurring suggestions" })
      .click();
    await page.getByRole("checkbox", { name: /Salary/ }).check();
    await choose(
      page,
      page.getByRole("combobox", { name: "Type", exact: true }),
      "Transfer",
    );
    await expect(
      page.getByRole("combobox", { name: "Transfer from" }),
    ).toBeVisible();
    await expect(
      page.getByText("Received into Statement account.", { exact: false }),
    ).toBeVisible();
    await choose(
      page,
      page.getByRole("combobox", { name: "Transfer from" }),
      "Other household account",
    );
    await page.getByRole("button", { name: "4. Confirm" }).click();
    await page
      .getByRole("checkbox", { name: /I have checked all statement pages/ })
      .check();
    await page
      .getByRole("button", { name: "Accept & import statement" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Statement imported" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Recurring items from this statement",
      }),
    ).toBeVisible();
    const incoming = await db.schedule.findFirstOrThrow();
    expect(incoming).toMatchObject({
      kind: "transfer",
      accountId: other.id,
      counterAccountId: source.id,
      categoryId: null,
      subscription: false,
    });
    const ledger = await db.transaction.findMany({ orderBy: { id: "asc" } });
    await page.getByRole("checkbox", { name: /Netflix/ }).check();
    await choose(
      page,
      page.getByRole("combobox", { name: "Type", exact: true }),
      "Transfer",
    );
    await expect(
      page.getByRole("button", { name: "Accept recurring items", exact: true }),
    ).toBeDisabled();
    await choose(
      page,
      page.getByRole("combobox", { name: "Transfer to" }),
      "Other household account",
    );
    const amount = page.getByLabel("Expected amount (AUD)", { exact: true });
    const originalAmount = await amount.inputValue();
    await amount.fill("not an amount");
    await amount.blur();
    await expect(amount).toHaveValue("not an amount");
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("alert").filter({ hasText: "valid positive amount" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept recurring items", exact: true }),
    ).toBeDisabled();
    await amount.fill(originalAmount);
    await amount.blur();
    const name = page.getByLabel("Recurring name", { exact: true });
    await name.fill("");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("button", { name: "Accept recurring items", exact: true }),
    ).toBeDisabled();
    await name.fill("Netflix");
    await expect(
      page.getByRole("button", { name: "Accept recurring items", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/recurring-transfers-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Accept recurring items", exact: true })
      .click();
    await expect(
      page.getByText("No additional recurring items found."),
    ).toBeVisible();
    expect(await db.transaction.findMany({ orderBy: { id: "asc" } })).toEqual(
      ledger,
    );
    expect(
      await db.schedule.findFirstOrThrow({ where: { name: "Netflix" } }),
    ).toMatchObject({
      kind: "transfer",
      accountId: source.id,
      counterAccountId: other.id,
      categoryId: null,
      subscription: false,
    });
    await page.goto("/plan?tab=bills");
    await page
      .getByRole("button", { name: "Edit Netflix", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit schedule" });
    await expect(
      dialog.getByRole("combobox", { name: "Type", exact: true }),
    ).toHaveText("Transfer");
    await expect(
      dialog.getByRole("combobox", { name: "From account", exact: true }),
    ).toHaveText("Statement account");
    await expect(
      dialog.getByRole("combobox", { name: "To account", exact: true }),
    ).toHaveText("Other household account");
    await dialog.getByLabel("Amount (AUD)").fill("25.01");
    await dialog.getByRole("button", { name: "Save schedule" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    expect(
      await db.schedule.findFirstOrThrow({ where: { name: "Netflix" } }),
    ).toMatchObject({ amountCents: 2501n, kind: "transfer" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await db.$disconnect();
  }
});
