import { test, expect, session, database } from "./fixtures";
import type { ImportRow, StatementDetails } from "@finance/shared";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";

test("a saved payment chosen for two rows can be cleared, skipped and linked once", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const source = await db.account.create({
      data: {
        name: "Repeated-link spending",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Repeated-link savings",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    const target = await db.transaction.create({
      data: {
        accountId: other.id,
        date: "2026-10-01",
        amountCents: 2500n,
        kind: "income",
        description: "One saved savings payment",
        notes: "Keep the original payment notes",
      },
    });
    const rows: ImportRow[] = [1, 2].map((rowNumber) => ({
      rowNumber,
      date: "2026-10-01",
      amountCents: -2500,
      description: `Savings transfer source ${rowNumber}`,
      kind: "transfer",
      counterAccountId: other.id,
      categoryId: null,
      owner: "household",
      include: true,
      allowDuplicate: false,
      duplicate: false,
      error: null,
      linkExisting: { id: target.id, version: target.version },
    }));
    const details: StatementDetails = {
      lines: [],
      opening: { date: "2026-01-01", amountCents: 100000 },
      closing: null,
      warnings: [],
      recurring: [],
    };
    // Exercise recovery of persisted review choices through the real API; source
    // extraction is covered by separate parser and upload journeys.
    const statement = await db.statement.create({
      data: {
        account: { connect: { id: source.id } },
        filename: "repeated-link-review.pdf",
        status: "ready",
        stage: "ready",
        pages: 1,
        content: statementPdf([["Synthetic repeated-link review"]]),
        details,
        importBatch: {
          create: {
            accountId: source.id,
            fileHash: "synthetic-repeated-link-review",
            mapping: {},
            preview: rows,
            expiresAt: new Date("2200-01-01T00:00:00Z"),
          },
        },
      },
    });
    await page.goto(`/accounts/${source.id}/statement/${statement.id}`);
    const first = page.getByRole("region", {
      name: "Conflict row 1",
      exact: true,
    });
    const second = page.getByRole("region", {
      name: "Conflict row 2",
      exact: true,
    });
    await expect(
      page.getByRole("heading", {
        name: "Check 2 matching rows before importing",
      }),
    ).toBeVisible();
    await expect(first).toContainText("This payment is also chosen for row 2.");
    await expect(second).toContainText(
      "This payment is also chosen for row 1.",
    );
    await expect(
      page.getByRole("button", { name: "Link this payment", exact: true }),
    ).toHaveCount(0);
    await first
      .getByRole("button", { name: "Clear link choice", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Check 1 matching row before importing",
      }),
    ).toBeVisible();
    await expect(second).toBeHidden();
    await expect(first).toContainText(
      "A payment with the opposite amount already exists in the other account.",
    );
    await expect(
      first.getByRole("button", { name: "Link this payment", exact: true }),
    ).toHaveCount(0);
    await first
      .getByRole("button", { name: "Skip row 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "2. Review transactions", exact: true })
      .click();
    const remaining = page.getByRole("article", {
      name: "Transaction row 2",
      exact: true,
    });
    await expect(remaining).toContainText(
      "This row will link to the chosen existing payment on approval.",
    );
    await expect(first).toBeHidden();
    await expect(second).toBeHidden();
    await remaining
      .getByRole("button", { name: "Undo link choice", exact: true })
      .click();
    await expect(second).toBeVisible();
    await second
      .getByRole("button", { name: "Link this payment", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Link the existing payment?" })
      .getByRole("button", { name: "Use this payment", exact: true })
      .click();
    await expect(remaining).toContainText(
      "This row will link to the chosen existing payment on approval.",
    );
    await expect(second).toBeHidden();
    expect(await db.transaction.findMany()).toEqual([target]);
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await expect(
      page.getByText("1 transactions selected · 1 excluded", { exact: true }),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    const committed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/statements/${statement.id}/commit`) &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Accept & import statement", exact: true })
      .click();
    expect((await committed).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Statement imported", exact: true }),
    ).toBeVisible();
    const linked = await db.transaction.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(linked).toMatchObject({
      kind: "transfer",
      version: 2,
      amountCents: target.amountCents,
      date: target.date,
      description: target.description,
      notes: target.notes,
    });
    expect(linked.transferGroupId).not.toBeNull();
    const pair = await db.transaction.findMany({
      where: { transferGroupId: linked.transferGroupId },
    });
    expect(pair).toHaveLength(2);
    expect(pair.find((item) => item.accountId === source.id)).toMatchObject({
      sourceRow: 2,
      amountCents: -2500n,
    });
    expect(await db.transaction.count()).toBe(2);
  } finally {
    await db.$disconnect();
  }
});
