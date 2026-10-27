import { test, expect, session, database, choose } from "./fixtures";

async function seed() {
  const db = await database();
  const source = await db.account.create({
    data: {
      name: "Spending",
      type: "bank",
      institution: "",
      owner: "household",
      openingDate: "2026-01-01",
      openingBalanceCents: 100000n,
    },
  });
  const other = await db.account.create({
    data: {
      name: "Savings",
      type: "bank",
      institution: "",
      owner: "household",
      openingDate: "2026-01-01",
      openingBalanceCents: 0n,
    },
  });
  const target = await db.transaction.create({
    data: {
      accountId: other.id,
      kind: "income",
      amountCents: 2500n,
      date: "2026-10-01",
      description: "Existing savings payment",
      owner: "household",
      notes: "Keep these notes",
    },
  });
  return { db, source, other, target };
}

test("CSV conflicts identify off-page payments, focus the source row and link only on approval", async ({
  page,
}, info) => {
  await session(page);
  const { db, source, other, target } = await seed();
  try {
    await page.goto(`/imports?account=${source.id}`);
    const csv =
      "Date,Description,Amount\n" +
      Array.from(
        { length: 21 },
        (_, i) => `2026-10-01,Purchase ${i + 1},-${i + 1}.01`,
      ).join("\n") +
      "\n2026-10-01,Move to savings,-25.00";
    await page
      .getByLabel("Choose bank CSV")
      .setInputFiles({
        name: "transfers.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      });
    await page
      .getByRole("button", { name: "Review transactions", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await choose(
      page,
      page.getByLabel("Type row 22"),
      "Transfer / card repayment",
    );
    await choose(page, page.getByLabel("Transfer account row 22"), "Savings");
    const conflict = page.getByRole("region", { name: "Conflict row 22" });
    await expect(conflict).toBeVisible();
    await expect(
      conflict.getByText("Existing savings payment", { exact: true }),
    ).toBeVisible();
    await expect(
      conflict.getByRole("link", { name: "Open matching payment" }),
    ).toHaveAttribute("href", `/transactions?detail=${target.id}`);
    await expect(
      page.getByRole("button", { name: "Approve & import (22)" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await conflict.getByRole("button", { name: "Review row 22" }).click();
    await expect(
      page.getByRole("article", { name: "Transaction row 22" }),
    ).toBeFocused();
    await conflict.getByRole("button", { name: "Link this payment" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(conflict).toBeVisible();
    expect(await db.transaction.count()).toBe(1);
    await conflict.getByRole("button", { name: "Link this payment" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Use this payment" })
      .click();
    await expect(conflict).toBeHidden();
    await expect(
      page.getByText("This row will link to the chosen existing payment", {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      await db.transaction.findUniqueOrThrow({ where: { id: target.id } }),
    ).toMatchObject({ kind: "income", version: 1 });
    await page.screenshot({
      path: `artifacts/import-link-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Approve & import (22)" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    const linked = await db.transaction.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(linked).toMatchObject({
      kind: "transfer",
      amountCents: 2500n,
      description: target.description,
      notes: target.notes,
      version: 2,
    });
    expect(await db.transaction.count({ where: { accountId: other.id } })).toBe(
      1,
    );
    expect(
      await db.transaction.findMany({
        where: { transferGroupId: linked.transferGroupId },
      }),
    ).toHaveLength(2);
  } finally {
    await db.$disconnect();
  }
});

test("new server-side matches surface at the top with skip and explicit separate-payment recovery", async ({
  page,
}) => {
  await session(page);
  const { db, source } = await seed();
  try {
    await page.goto(`/imports?account=${source.id}`);
    await page
      .getByLabel("Choose bank CSV")
      .setInputFiles({
        name: "late-match.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "Date,Description,Amount\n2026-10-01,Late match one,-11.00\n2026-10-02,Late match two,-12.00",
        ),
      });
    await page
      .getByRole("button", { name: "Review transactions", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Approve & import (2)" }),
    ).toBeEnabled();
    await db.transaction.createMany({
      data: [1, 2].map((n) => ({
        accountId: source.id,
        kind: "expense",
        amountCents: BigInt(-(10 + n) * 100),
        date: `2026-10-0${n}`,
        description: `Saved match ${n}`,
        owner: "household",
      })),
    });
    const rejected = page.waitForResponse(
      (response) =>
        response.url().endsWith("/commit") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Approve & import (2)" }).click();
    expect((await rejected).status()).toBe(409);
    await expect(
      page.getByRole("heading", {
        name: "Check 2 matching rows before importing",
      }),
    ).toBeVisible();
    await page
      .getByRole("region", { name: "Conflict row 1" })
      .getByRole("button", { name: "Skip row 1" })
      .click();
    const second = page.getByRole("region", { name: "Conflict row 2" });
    await second
      .getByRole("button", { name: "Keep as a separate payment" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm separate payment" })
      .click();
    await page.getByRole("button", { name: "Approve & import (1)" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    expect(
      await db.transaction.count({ where: { accountId: source.id } }),
    ).toBe(3);
  } finally {
    await db.$disconnect();
  }
});
