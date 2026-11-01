import {
  test,
  expect,
  session,
  database,
  choose,
  chooseDate,
  tickFilter,
  choosePeriod,
} from "./fixtures";

test("Expenses type edits wait for saving then offer similar transfers only inside report filters @timing", async ({
  page,
}) => {
  // Install before navigation so mutation timers and query invalidation are controlled.
  await page.clock.install();
  const owner = await session(page);
  const db = await database();
  let release = () => {};
  try {
    const accounts = await Promise.all(
      ["Everyday", "Savings", "Hidden bank"].map((name) =>
        db.account.create({
          data: {
            name,
            type: "bank",
            owner,
            openingDate: "2026-01-01",
            openingBalanceCents: 1000000n,
          },
        }),
      ),
    );
    const groceries = await db.category.findFirstOrThrow({
      where: { name: "Groceries" },
    });
    const dining = await db.category.findFirstOrThrow({
      where: { name: "Dining" },
    });
    const base = {
      accountId: accounts[0].id,
      owner,
      kind: "expense",
      amountCents: -1000n,
      date: "2026-10-05",
      description: "Savings contribution",
      categoryId: groceries.id,
    };
    const source = await db.transaction.create({
      data: { ...base, date: "2026-10-06" },
    });
    const match = await db.transaction.create({ data: base });
    const hidden = await Promise.all(
      [
        { ...base, accountId: accounts[2].id },
        { ...base, date: "2026-09-05" },
        { ...base, categoryId: dining.id },
      ].map((data) => db.transaction.create({ data })),
    );
    await page.goto("/expenses");
    await choosePeriod(page, "All history");
    await tickFilter(page, "Account", ["Everyday"]);
    await tickFilter(page, "Category", ["Groceries"]);
    await chooseDate(
      page,
      page.getByRole("button", { name: "From", exact: true }),
      "2026-10-01",
    );
    const list = page.getByRole("list", {
      name: "Expense transactions",
      exact: true,
    });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    const first = list.getByRole("listitem").first();
    await choose(
      page,
      first.getByRole("combobox", {
        name: "Type for Savings contribution",
        exact: true,
      }),
      "Transfer",
    );
    await choose(
      page,
      first.getByRole("combobox", {
        name: "Other account for Savings contribution",
        exact: true,
      }),
      "Savings",
    );
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/transactions/${source.id}/type`, async (route) => {
      const response = await route.fetch();
      await barrier;
      await route.fulfill({ response });
    });
    const requested = page.waitForRequest(
      (request) =>
        request.url().endsWith(`/${source.id}/type`) &&
        request.method() === "PUT",
    );
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/${source.id}/type`) &&
        response.request().method() === "PUT",
    );
    await first.getByRole("button", { name: "Save type", exact: true }).click();
    await requested;
    await expect(
      first.getByRole("status").filter({ hasText: "Saving…" }),
    ).toHaveText("Saving…");
    await expect(
      first.getByRole("combobox", {
        name: "Category for Savings contribution",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      first.getByRole("button", {
        name: "Remember Savings contribution",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("dialog", { name: "Remember this transaction" }),
    ).toHaveCount(0);
    release();
    expect((await saved).ok()).toBe(true);
    const dialog = page.getByRole("dialog", {
      name: "Remember this transaction",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Your transaction is now a transfer");
    await expect(dialog).toContainText(
      "Found 1 matching transactions in the current filters",
    );
    await expect(dialog).toContainText(
      "Also saves a rule for future transactions",
    );
    // The edited expense leaves the filtered list; the confirmation stays open.
    await expect(
      page
        .getByRole("list", {
          name: "Expense transactions",
          exact: true,
          includeHidden: true,
        })
        .getByRole("listitem", { includeHidden: true }),
    ).toHaveCount(1);
    const remembered = page.waitForResponse(
      (response) =>
        response.url().endsWith("/transactions/remember") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Save rule & apply to 1", exact: true })
      .click();
    expect((await remembered).ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("No transactions in this selection.", { exact: true }),
    ).toBeVisible();
    for (const id of [source.id, match.id])
      expect(
        await db.transaction.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ kind: "transfer", categoryId: null });
    expect(await db.transaction.count({ where: { kind: "transfer" } })).toBe(4);
    for (const row of hidden)
      expect(
        await db.transaction.findUniqueOrThrow({ where: { id: row.id } }),
      ).toMatchObject({
        kind: "expense",
        version: row.version,
        categoryId: row.categoryId,
      });
    expect(await db.rule.findFirstOrThrow()).toMatchObject({
      kind: "transfer",
      accountId: accounts[0].id,
      counterAccountId: accounts[1].id,
      enabled: true,
    });
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await db.$disconnect();
  }
});
