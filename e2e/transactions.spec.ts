import { test, expect, session, choose } from "./fixtures";
import type { Page } from "@playwright/test";
import { today } from "../packages/shared/src/index";
const headers = { Origin: "http://localhost:3000" };
async function createAccount(
  page: Page,
  name = "Everyday",
  openingBalanceCents = 500000,
) {
  const response = await page.request.post("/api/accounts", {
    headers,
    data: {
      name,
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
async function seedTransaction(
  page: Page,
  accountId: string,
  kind: "expense" | "refund",
  amountCents: number,
) {
  const response = await page.request.post("/api/transactions", {
    headers,
    data: {
      accountId,
      kind,
      amountCents,
      date: today(),
      description: kind === "expense" ? "Grocer" : "Return",
    },
  });
  expect(response.status()).toBe(201);
}
for (const kind of ["expense", "refund"] as const) {
  test(`${kind} form preserves category and reconciles spending`, async ({
    page,
  }) => {
    await session(page);
    const id = await createAccount(page);
    if (kind === "refund") await seedTransaction(page, id, "expense", 2155);
    await page.goto("/transactions?new=1");
    const dialog = page.getByRole("dialog");
    const description = kind === "expense" ? "Grocer" : "Return";
    await dialog.getByLabel("Description", { exact: true }).fill(description);
    await choose(
      page,
      dialog.getByRole("combobox", { name: "Type", exact: true }),
      kind === "expense" ? "Expense" : "Refund",
    );
    await dialog
      .getByLabel("Amount (AUD)")
      .fill(kind === "expense" ? "21.55" : "5.00");
    await choose(
      page,
      dialog.getByRole("combobox", { name: "Category", exact: true }),
      "Groceries",
    );
    await dialog
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByRole("button", {
        name:
          kind === "expense"
            ? /Available balance.*4,978.45/
            : /Available balance.*4,983.45/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: kind === "expense" ? /Money out.*21.55/ : /Money out.*16.55/,
      }),
    ).toBeVisible();
  });
}
test("linked transfer form preserves combined balances and net refund spending", async ({
  page,
}) => {
  await session(page);
  const id = await createAccount(page);
  await createAccount(page, "Savings", 0);
  // Real API fixtures retain the original combined expense/refund/transfer
  // assertion, while each transaction form is exercised in its own UI case.
  await seedTransaction(page, id, "expense", 2155);
  await seedTransaction(page, id, "refund", 500);
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await choose(
    page,
    dialog.getByRole("combobox", { name: "From account" }),
    "Everyday",
  );
  await choose(
    page,
    dialog.getByRole("combobox", { name: "To account" }),
    "Savings",
  );
  await dialog.getByLabel("Amount (AUD)").fill("100");
  await dialog.getByRole("button", { name: "Record transfer" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Available balance.*4,983.45/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Money out.*16.55/ }),
  ).toBeVisible();
});
