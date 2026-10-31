import { test, expect, session, database, choose } from "./fixtures";

test("Remember transfers previews all filtered pages, confirms counterparts, and leaves other months/accounts alone", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
    const accounts = await Promise.all(
      ["Everyday", "Savings", "Hidden account"].map((name) =>
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
    const base = {
      accountId: accounts[0].id,
      owner: "household",
      date: "2026-10-01",
      kind: "expense",
      amountCents: -42500n,
      description: "NetBank Rent",
    };
    const first = await db.transaction.create({
      data: {
        ...base,
        date: "2026-10-31",
        description: "NetBank Rent October",
      },
    });
    await db.transaction.createMany({
      data: [
        ...Array.from({ length: 54 }, () => base),
        { ...base, date: "2026-07-01" },
        { ...base, accountId: accounts[2].id },
      ],
    });
    await page.goto("/accounts/" + accounts[0].id);
    await page.getByLabel("From date", { exact: true }).fill("2026-10-01");
    await page.getByLabel("To date", { exact: true }).fill("2026-10-31");
    const type = page.getByRole("combobox", {
      name: "Type for NetBank Rent October",
      exact: true,
    });
    await choose(page, type, "Transfer");
    await choose(
      page,
      page.getByLabel("Other account for NetBank Rent October", {
        exact: true,
      }),
      "Savings",
    );
    const savedType = page.waitForResponse(
      (r) => r.url().endsWith("/type") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save type", exact: true }).click();
    expect((await savedType).ok()).toBe(true);
    await expect(type).toHaveText("Transfer");
    const remember = page.getByRole("button", {
      name: "Remember NetBank Rent October",
      exact: true,
    });
    await remember.click();
    const dialog = page.getByRole("dialog");
    await choose(
      page,
      dialog.getByLabel("Match descriptions", { exact: true }),
      "Containing text",
    );
    await dialog
      .getByLabel("Remembered text", { exact: true })
      .fill("NetBank Rent");
    await expect(dialog.getByRole("status")).toContainText(
      "55 matching transactions in the current filters",
    );
    await expect(
      dialog.getByText("54 to update · 1 already correct."),
    ).toBeVisible();
    await expect(
      dialog.getByText(/create 54 counterpart entries in Savings/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await db.rule.count()).toBe(0);
    expect(await db.transaction.count({ where: { kind: "transfer" } })).toBe(2);
    await remember.click();
    await choose(
      page,
      dialog.getByLabel("Match descriptions", { exact: true }),
      "Containing text",
    );
    await dialog
      .getByLabel("Remembered text", { exact: true })
      .fill("NetBank Rent");
    await page.screenshot({
      path: `artifacts/remember-transfer-${info.project.name}.png`,
    });
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/transactions/remember") &&
        r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Save rule & apply to 55", exact: true })
      .click();
    expect((await saved).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    expect(await db.transaction.count({ where: { kind: "transfer" } })).toBe(
      110,
    );
    expect(
      await db.transaction.count({ where: { kind: "expense", version: 1 } }),
    ).toBe(2);
    expect(await db.rule.findFirst()).toMatchObject({
      kind: "transfer",
      accountId: accounts[0].id,
      counterAccountId: accounts[1].id,
    });
    await expect(
      page
        .getByText("Matches saved rule", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(50);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page
        .getByText("Matches saved rule", { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(5);
    await page.reload();
    await expect(type).toHaveText("Transfer");
    const rows = await db.transaction.findMany({ where: { kind: "transfer" } });
    expect(rows.reduce((n, r) => n + r.amountCents, 0n)).toBe(0n);
    expect(rows.find((r) => r.id === first.id)?.amountCents).toBe(-42500n);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/categories");
    await page
      .getByRole("button", { name: /^Contains “netbank rent”/ })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Rule action", { exact: true }),
    ).toHaveText("Transfer between accounts");
    await page
      .getByRole("dialog")
      .getByLabel("Enable rule", { exact: true })
      .uncheck();
    const paused = page.waitForResponse(
      (r) => r.url().includes("/rules/") && r.request().method() === "PUT",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save rule", exact: true })
      .click();
    expect((await paused).ok()).toBe(true);
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await db.rule.findFirst())?.enabled).toBe(false);
  } finally {
    await db.$disconnect();
  }
});

test("ambiguous transfer matches require distinct confirmed counterparts", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  try {
    const accounts = await Promise.all(
      ["Bank", "Savings"].map((name) =>
        db.account.create({
          data: {
            name,
            type: "bank",
            owner: "household",
            openingDate: "2026-01-01",
            openingBalanceCents: 10000n,
          },
        }),
      ),
    );
    const base = {
      accountId: accounts[0].id,
      owner: "household",
      date: "2026-10-01",
      kind: "expense",
      amountCents: -1000n,
      description: "Rent",
    };
    const result = await page.request.post("/api/transfers", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        fromAccountId: accounts[0].id,
        toAccountId: accounts[1].id,
        date: "2026-10-31",
        amountCents: 1000,
        description: "Rent source",
      },
    });
    expect(result.ok()).toBe(true);
    await db.transaction.createMany({
      data: [
        base,
        { ...base, description: "Rent second" },
        {
          ...base,
          accountId: accounts[1].id,
          kind: "income",
          amountCents: 1000n,
          description: "Existing payment",
        },
      ],
    });
    await page.goto("/accounts/" + accounts[0].id);
    await page
      .getByRole("button", { name: "Remember Rent source", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await choose(
      page,
      dialog.getByLabel("Match descriptions", { exact: true }),
      "Containing text",
    );
    await dialog.getByLabel("Remembered text", { exact: true }).fill("Rent");
    const save = dialog.getByRole("button", {
      name: "Save rule & apply to 3",
      exact: true,
    });
    await expect(save).toBeDisabled();
    const first = dialog.getByRole("combobox", {
      name: "Other entry for Rent on 2026-10-01",
      exact: true,
    });
    const second = dialog.getByRole("combobox", {
      name: "Other entry for Rent second on 2026-10-01",
      exact: true,
    });
    await choose(page, first, "Link: Existing payment · $10.00");
    await choose(page, second, "Link: Existing payment · $10.00");
    await expect(save).toBeDisabled();
    await choose(page, second, "Create a separate counterpart entry");
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/transactions/remember") &&
        r.request().method() === "POST",
    );
    await save.click();
    expect((await saved).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    const rows = await db.transaction.findMany();
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.kind === "transfer")).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.amountCents, 0n)).toBe(0n);
  } finally {
    await db.$disconnect();
  }
});
