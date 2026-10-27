import { test, expect, session, database } from "./fixtures";
import type { ImportRow, StatementDetails } from "@finance/shared";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";

test("statement conflicts stay above every step and skip an off-page source row before approval", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const source = await db.account.create({
      data: {
        name: "Statement spending",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Statement savings",
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
        description: "Saved statement counterpart",
        notes: "Preserve this saved payment",
      },
    });
    const rows: ImportRow[] = Array.from({ length: 22 }, (_, index) => ({
      rowNumber: index + 1,
      date: "2026-10-01",
      amountCents: index === 21 ? -2500 : -(index + 1) * 100,
      description:
        index === 21
          ? "Move statement money to savings"
          : `Statement purchase ${index + 1}`,
      kind: index === 21 ? "transfer" : "expense",
      counterAccountId: index === 21 ? other.id : null,
      categoryId: null,
      owner: "household",
      include: true,
      allowDuplicate: false,
      duplicate: false,
      error: null,
    }));
    const details: StatementDetails = {
      lines: [],
      opening: { date: "2026-01-01", amountCents: 100000 },
      closing: null,
      warnings: [],
      recurring: [],
    };
    // Seed a saved ready review: PDF extraction is covered separately, while this
    // journey exercises the real preview and atomic commit APIs with isolated data.
    const statement = await db.statement.create({
      data: {
        account: { connect: { id: source.id } },
        filename: "statement-conflicts.pdf",
        status: "ready",
        stage: "ready",
        pages: 1,
        content: statementPdf([["Synthetic statement conflict review"]]),
        details,
        importBatch: {
          create: {
            accountId: source.id,
            fileHash: "synthetic-statement-conflicts",
            mapping: {},
            preview: rows,
            expiresAt: new Date("2200-01-01T00:00:00Z"),
          },
        },
      },
    });
    await page.goto(`/accounts/${source.id}/statement/${statement.id}`);
    const heading = page.getByRole("heading", {
      name: "Check 1 matching row before importing",
    });
    const conflict = page.getByRole("region", {
      name: "Conflict row 22",
      exact: true,
    });
    await expect(
      page.getByRole("heading", { name: "Start with the right balance" }),
    ).toBeVisible();
    await expect(heading).toBeVisible();
    expect((await heading.boundingBox())!.y).toBeLessThan(
      (await page
        .getByText("statement-conflicts.pdf", { exact: true })
        .boundingBox())!.y,
    );
    await expect(
      conflict.getByText("Saved statement counterpart", { exact: true }),
    ).toBeVisible();
    await expect(
      conflict.getByText("Statement savings", { exact: false }),
    ).toBeVisible();
    await expect(
      conflict.getByRole("link", { name: "Open matching payment" }),
    ).toHaveAttribute("href", `/transactions?detail=${target.id}`);
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ready to bring it together?" }),
    ).toBeVisible();
    await expect(heading).toBeVisible();
    await page.getByRole("checkbox").check();
    const approve = page.getByRole("button", {
      name: "Accept & import statement",
      exact: true,
    });
    await expect(approve).toBeDisabled();
    await conflict.getByRole("button", { name: "Review row 22" }).click();
    const row = page.getByRole("article", {
      name: "Transaction row 22",
      exact: true,
    });
    await expect(row).toBeFocused();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await expect(row.getByLabel("Transfer account row 22")).toContainText(
      "Statement savings",
    );
    await page.screenshot({
      path: `artifacts/statement-conflicts-${info.project.name}.png`,
    });
    await conflict.getByRole("button", { name: "Skip row 22" }).click();
    await expect(
      row.getByRole("checkbox", { name: "Include row 22" }),
    ).not.toBeChecked();
    await expect(heading).toBeHidden();
    await expect(conflict).toBeHidden();
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await expect(
      page.getByText("21 transactions selected · 1 excluded", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    expect(await db.transaction.findMany()).toEqual([target]);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: source.id } }),
    ).toEqual(source);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: other.id } }),
    ).toEqual(other);
    await page.getByRole("checkbox").check();
    await expect(approve).toBeEnabled();
    const committed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/statements/${statement.id}/commit`) &&
        response.request().method() === "POST",
    );
    await approve.click();
    expect((await committed).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Statement imported", exact: true }),
    ).toBeVisible();
    expect(
      await db.transaction.count({ where: { accountId: source.id } }),
    ).toBe(21);
    expect(
      await db.transaction.findUniqueOrThrow({ where: { id: target.id } }),
    ).toEqual(target);
    expect(await db.transaction.count({ where: { kind: "transfer" } })).toBe(0);
    const total = await db.transaction.aggregate({
      where: { accountId: source.id },
      _sum: { amountCents: true },
    });
    expect(total._sum.amountCents).toBe(-23100n);
  } finally {
    await db.$disconnect();
  }
});
