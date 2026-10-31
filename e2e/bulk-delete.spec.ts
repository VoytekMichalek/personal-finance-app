import { randomUUID } from "node:crypto";
import { test, expect, session, database } from "./fixtures";

test("bulk deletion respects account filters across pages, cancels safely and persists", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const account = await db.account.create({
      data: {
        name: "Cleanup account",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Other account",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    await db.transaction.createMany({
      data: [
        ...Array.from({ length: 55 }, (_, index) => ({
          accountId: account.id,
          description: "Cleanup " + index,
        })),
        { accountId: account.id, description: "Keep hidden" },
        { accountId: other.id, description: "Cleanup other account" },
      ].map((row) => ({
        ...row,
        date: "2026-01-02",
        amountCents: -100n,
        kind: "expense",
      })),
    });
    await page.goto("/accounts/" + account.id);
    await page.getByLabel("Search transactions").fill("Cleanup");
    await page
      .getByRole("button", { name: "Select all 55 matching transactions" })
      .click();
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Delete selected transactions?",
    });
    await expect(dialog).toContainText(
      "55 selected transactions will be deleted.",
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await db.transaction.count()).toBe(57);
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/bulk-delete-${info.project.name}.png`,
      fullPage: true,
      // Keep the full long ledger within WebKit’s 32,767-device-pixel image limit.
      scale: "css",
    });
    const deleted = page.waitForResponse((response) =>
      response.url().endsWith("/transactions/bulk-delete"),
    );
    await dialog
      .getByRole("button", { name: "Delete 55 entries", exact: true })
      .click();
    expect((await deleted).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("status").filter({ hasText: "0 selected" }),
    ).toBeVisible();
    expect(await db.transaction.count()).toBe(2);
    await page.reload();
    await expect(
      page.getByRole("button", { name: /^Keep hidden / }),
    ).toBeVisible();
    await expect(
      page.getByText("$999.00", { exact: true }).first(),
    ).toBeVisible();
    // The global transaction page uses the same filter-aware delete action.
    await page.goto("/transactions?account=" + other.id);
    await page
      .getByRole("button", { name: "Select all 1 matching transactions" })
      .click();
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Delete 1 entry", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    expect(await db.transaction.count()).toBe(1);
    expect((await db.transaction.findFirstOrThrow()).description).toBe(
      "Keep hidden",
    );
  } finally {
    await db.$disconnect();
  }
});

test("transfer-only selection confirms both sides and recovers from receipt and stale-version conflicts", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const accounts = await Promise.all(
      ["From account", "To account"].map((name) =>
        db.account.create({
          data: {
            name,
            type: "bank",
            openingDate: "2026-01-01",
            openingBalanceCents: 100000n,
          },
        }),
      ),
    );
    const transferGroupId = randomUUID();
    const rows = await Promise.all(
      accounts.map((account, index) =>
        db.transaction.create({
          data: {
            accountId: account.id,
            date: "2026-01-02",
            amountCents: index ? 10000n : -10000n,
            kind: "transfer",
            description: "Linked movement",
            transferGroupId,
          },
        }),
      ),
    );
    const receipt = await db.receipt.create({
      data: {
        transactionId: rows[1]!.id,
        objectKey: "synthetic-receipt",
        filename: "receipt.png",
        mimeType: "image/png",
        size: 1,
      },
    });
    await page.goto("/accounts/" + accounts[0]!.id);
    await page
      .getByRole("checkbox", { name: "Select Linked movement", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "1 linked transfer entry outside your selection",
    );
    await dialog
      .getByRole("button", { name: "Delete 2 entries", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Remove attached receipts",
    );
    expect(await db.transaction.count()).toBe(2);
    await db.receipt.delete({ where: { id: receipt.id } });
    await db.transaction.update({
      where: { id: rows[1]!.id },
      data: { version: 2 },
    });
    await dialog
      .getByRole("button", { name: "Delete 2 entries", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "linked transfer changed",
    );
    expect(await db.transaction.count()).toBe(2);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await page
      .getByRole("checkbox", { name: "Select Linked movement", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Delete 2 entries", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    expect(await db.transaction.count()).toBe(0);
    await expect(
      page.getByText("$1,000.00", { exact: true }).first(),
    ).toBeVisible();
    await page.goto("/accounts/" + accounts[1]!.id);
    await expect(
      page.getByText("$1,000.00", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
