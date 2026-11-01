import {
  chooseDate,
  test,
  expect,
  session,
  database,
  choose,
} from "./fixtures";

for (const view of ["all", "account"]) {
  test(`changing an expense offers similar transfers within ${view} filters after saving @timing @transfer-remember-timing`, async ({
    page,
  }) => {
    await page.clock.install();
    await session(page);
    const db = await database();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const accounts = await Promise.all(
        ["Everyday", "Savings", "Other bank"].map((name) =>
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
      const base = {
        accountId: accounts[0].id,
        kind: "expense",
        amountCents: -1000n,
        owner: "household",
        description: "Regular savings payment",
        date: "2026-10-01",
        categoryId: view === "account" ? category.id : null,
      };
      const source = await db.transaction.create({
        data: {
          ...base,
          date: "2026-10-31",
          description: "Regular savings payment OCT26/00823316",
        },
      });
      const target = await db.transaction.create({ data: base });
      const other = await db.transaction.create({
        data: {
          ...base,
          accountId: accounts[1].id,
          kind: "income",
          amountCents: 1000n,
          description: "Bank receipt",
          categoryId: null,
          notes: "Keep recipient note",
        },
      });
      const hidden = await Promise.all([
        db.transaction.create({ data: { ...base, date: "2026-09-01" } }),
        db.transaction.create({ data: { ...base, accountId: accounts[2].id } }),
        db.transaction.create({
          data: { ...base, description: "Different payment" },
        }),
      ]);
      await page.goto(
        view === "all" ? "/transactions" : `/accounts/${accounts[0].id}`,
      );
      if (view === "all")
        await choose(
          page,
          page.getByLabel("Filter account", { exact: true }),
          "Everyday",
        );
      await chooseDate(
        page,
        page.getByLabel("From date", { exact: true }),
        "2026-10-01",
      );
      await chooseDate(
        page,
        page.getByLabel("To date", { exact: true }),
        "2026-10-31",
      );
      await choose(
        page,
        page.getByLabel("Filter category", { exact: true }),
        view === "all" ? "Uncategorised" : "Dining",
      );
      await choose(
        page,
        page.getByLabel("Filter type", { exact: true }),
        "Expenses & refunds",
      );
      const picker = page.getByRole("combobox", {
        name: `Type for ${source.description}`,
        exact: true,
      });
      await choose(page, picker, "Transfer");
      await choose(
        page,
        page.getByLabel(`Other account for ${source.description}`, {
          exact: true,
        }),
        "Savings",
      );
      await page.route("**/api/transactions/*/type", async (route) => {
        await barrier;
        await route.continue();
      });
      const saved = page.waitForResponse(
        (r) => r.url().endsWith("/type") && r.request().method() === "PUT",
      );
      await page
        .getByRole("button", { name: "Save type", exact: true })
        .click();
      await expect(picker).toBeDisabled();
      await expect(
        page.getByRole("status").filter({ hasText: "Saving…" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      release();
      expect((await saved).ok()).toBe(true);
      const dialog = page.getByRole("dialog", {
        name: "Remember this transaction",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("status")).toContainText(
        "Found 1 matching transactions in the current filters",
      );
      await expect(
        dialog.getByText(/link 1 existing payments and create 0 counterpart/),
      ).toBeVisible();
      expect(await db.rule.count()).toBe(0);
      expect(
        (await db.transaction.findUniqueOrThrow({ where: { id: target.id } }))
          .kind,
      ).toBe("expense");
      const applied = page.waitForResponse(
        (r) =>
          r.url().endsWith("/transactions/remember") &&
          r.request().method() === "POST",
      );
      await dialog
        .getByRole("button", { name: "Save rule & apply to 1", exact: true })
        .click();
      expect((await applied).ok()).toBe(true);
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("button", {
          name: "Select all 1 matching transactions",
          exact: true,
        }),
      ).toBeVisible();
      const stored = await db.transaction.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(stored).toMatchObject({
        kind: "transfer",
        categoryId: null,
        amountCents: target.amountCents,
        date: target.date,
      });
      expect(
        await db.transaction.findUniqueOrThrow({ where: { id: other.id } }),
      ).toMatchObject({
        kind: "transfer",
        transferGroupId: stored.transferGroupId,
        notes: other.notes,
        amountCents: other.amountCents,
      });
      for (const row of hidden)
        expect(
          await db.transaction.findUnique({ where: { id: row.id } }),
        ).toEqual(row);
      expect(await db.transaction.count()).toBe(7);
      expect(await db.rule.findFirst()).toMatchObject({
        kind: "transfer",
        accountId: accounts[0].id,
        counterAccountId: accounts[1].id,
        enabled: true,
      });
      await page.reload();
      // Filters now survive reload; transfers remain excluded until the user clears them.
      await expect(page.getByLabel("Filter type", { exact: true })).toHaveText(
        "Expenses & refunds",
      );
      await expect(picker).toHaveCount(0);
      await page
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      if (view === "all")
        await choose(
          page,
          page.getByLabel("Filter account", { exact: true }),
          "Everyday",
        );
      await expect(
        page.getByRole("combobox", {
          name: `Type for ${source.description}`,
          exact: true,
        }),
      ).toHaveText("Transfer");
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
      await db.$disconnect();
    }
  });
}

test("cancelling automatic transfer remembering keeps only the initial type change", async ({
  page,
}, info) => {
  await session(page);
  const db = await database();
  try {
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
    const base = {
      accountId: accounts[0].id,
      kind: "expense",
      amountCents: -1000n,
      owner: "household",
      description: "Monthly saving",
      date: "2026-10-01",
    };
    const source = await db.transaction.create({
      data: { ...base, date: "2026-10-31" },
    });
    const target = await db.transaction.create({ data: base });
    await page.goto(`/accounts/${accounts[0].id}`);
    await choose(
      page,
      page
        .getByRole("combobox", { name: "Type for Monthly saving", exact: true })
        .first(),
      "Transfer",
    );
    await choose(
      page,
      page.getByLabel("Other account for Monthly saving", { exact: true }),
      "Savings",
    );
    await page.getByRole("button", { name: "Save type", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("status")).toContainText(
      "2 matching transactions",
    );
    await page.screenshot({
      path: `artifacts/automatic-transfer-rule-${info.project.name}.png`,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await db.rule.count()).toBe(0);
    expect(
      await db.transaction.findUnique({ where: { id: target.id } }),
    ).toEqual(target);
    expect(
      (await db.transaction.findUniqueOrThrow({ where: { id: source.id } }))
        .kind,
    ).toBe("transfer");
    expect(await db.transaction.count()).toBe(3);
  } finally {
    await db.$disconnect();
  }
});
