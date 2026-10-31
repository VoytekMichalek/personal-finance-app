import { randomUUID } from "node:crypto";
import { test, expect, session, database } from "./fixtures";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";

test("CSV accepts clear transfer reconciliations across pages and keeps ambiguous matches for individual review", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const source = await db.account.create({
      data: {
        name: "Nicola savings",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 50000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Voytek spending",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    const entries = Array.from({ length: 23 }, (_, i) => {
      const group = randomUUID();
      return [
        {
          accountId: source.id,
          kind: "transfer",
          amountCents: BigInt((i + 1) * 100),
          date: "2026-10-01",
          description: `Already entered ${i}`,
          owner: "household",
          transferGroupId: group,
        },
        {
          accountId: other.id,
          kind: "transfer",
          amountCents: BigInt(-(i + 1) * 100),
          date: "2026-10-01",
          description: `Already entered ${i}`,
          owner: "household",
          transferGroupId: group,
        },
      ];
    }).flat();
    await db.transaction.createMany({ data: entries });
    // A second payment with the same date and amount must not be bulk reconciled.
    await db.transaction.create({
      data: {
        accountId: source.id,
        kind: "income",
        amountCents: 2300n,
        date: "2026-10-01",
        description: "Ambiguous amount",
        owner: "household",
      },
    });
    await page.goto(`/imports?account=${source.id}`);
    await page.getByLabel("Choose bank CSV").setInputFiles({
      name: "nicola.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Date,Description,Amount\n" +
          Array.from(
            { length: 23 },
            (_, i) => `2026-10-01,Bank description ${i},${i + 1}.00`,
          ).join("\n"),
      ),
    });
    await page
      .getByRole("button", { name: "Review transactions", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept reconciliations (22)" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Accept reconciliations (22)" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "22 reconciliations accepted" }),
    ).toBeVisible();
    expect(
      await db.transaction.count({ where: { importBatchId: { not: null } } }),
    ).toBe(0);
    await expect(
      page.getByText("App balance after selected rows", { exact: false }),
    ).toContainText("$799.00");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("article", { name: "Transaction row 22", exact: true }),
    ).toContainText("Reconciliation accepted");
    await expect(
      page.getByRole("article", { name: "Transaction row 23", exact: true }),
    ).toContainText("Possible duplicate");
    await page
      .getByRole("button", { name: "Undo reconciliation for row 22" })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept reconciliations (1)" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Accept reconciliations (1)" })
      .click();
    await page.screenshot({
      path: `artifacts/reconciliations-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Approve & import (22)" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    expect(await db.transaction.count()).toBe(47);
    expect(
      await db.transaction.count({
        where: { accountId: source.id, importBatchId: { not: null } },
      }),
    ).toBe(22);
    expect(
      await db.transaction.aggregate({
        where: { accountId: source.id },
        _sum: { amountCents: true },
      }),
    ).toMatchObject({ _sum: { amountCents: 29900n } });
  } finally {
    await db.$disconnect();
  }
});

test("PDF reconciles the other side of a transfer and retains an existing opening balance", async ({
  page,
  baseURL,
}) => {
  await session(page);
  const db = await database();
  const headers = { Origin: baseURL! };
  try {
    const source = await db.account.create({
      data: {
        name: "Nicola account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 50000n,
      },
    });
    const other = await db.account.create({
      data: {
        name: "Voytek account",
        type: "bank",
        owner: "household",
        openingDate: "2026-01-01",
        openingBalanceCents: 0n,
      },
    });
    expect(
      (
        await page.request.post("/api/transfers", {
          headers,
          data: {
            fromAccountId: other.id,
            toAccountId: source.id,
            date: "2026-10-01",
            amountCents: 2500,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/accounts/${source.id}/statement`);
    await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
      name: "reconcile.pdf",
      mimeType: "application/pdf",
      buffer: statementPdf([
        [
          "Bank statement 2026",
          "Opening balance 525.00",
          "01/10/2026 Received household transfer +25.00",
          "02/10/2026 Coffee -5.00",
          "Closing balance 545.00",
        ],
      ]),
    });
    await expect(
      page.getByRole("button", { name: "Accept reconciliations (1)" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Use the statement’s opening balance"),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Use the statement’s opening balance"),
    ).not.toBeChecked();
    await page
      .getByRole("button", { name: "Accept reconciliations (1)" })
      .click();
    await page.getByRole("button", { name: "4. Confirm" }).click();
    await expect(
      page.getByText("Keep the existing account opening balance"),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Accept & import statement" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Statement imported" }),
    ).toBeVisible();
    expect(await db.transaction.count()).toBe(3);
    expect(
      await db.account.findUniqueOrThrow({ where: { id: source.id } }),
    ).toMatchObject({ openingDate: "2026-01-01", openingBalanceCents: 50000n });
    expect(
      await db.transaction.count({
        where: { accountId: source.id, importBatchId: { not: null } },
      }),
    ).toBe(2);
  } finally {
    await db.$disconnect();
  }
});
