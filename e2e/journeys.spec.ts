import { choose } from "./fixtures";
import { test, expect, session, account, database } from "./fixtures";
import { today } from "../packages/shared/src/index";

test("accounts and CSV review work across screen sizes", async ({ page }) => {
  await session(page);
  await account(page);
  await page.getByRole("button", { name: /Everyday/ }).click();
  await expect(
    page.getByRole("link", { name: "Upload statement" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Upload CSV" }).click();
  await expect(page.getByLabel("Import into")).toHaveText("Everyday");
  await page.getByLabel("Choose bank CSV").setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n" +
        today().split("-").reverse().join("/") +
        ",Salary,2000.00\n" +
        today().split("-").reverse().join("/") +
        ",Groceries,-120.50\n" +
        today().split("-").reverse().join("/") +
        ",Returned groceries,20.50",
    ),
  });
  await page.getByRole("button", { name: "Review transactions" }).click();
  await expect(page.getByText("3 valid")).toBeVisible();
  await choose(page, page.getByLabel("Type row 3"), "Refund");
  await choose(page, page.getByLabel("Category row 2"), "Groceries");
  await choose(page, page.getByLabel("Category row 3"), "Groceries");
  await page.getByRole("button", { name: "Approve & import (3)" }).click();
  await expect(page.getByText("3 transactions imported")).toBeVisible();
  await page.goto("/transactions");
  await expect(
    page.getByText("Returned groceries", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("+$2,000.00", { exact: true })).toBeVisible();
});

test("budgets, net worth, overview and documentation work across screen sizes", async ({
  page,
}, info) => {
  await session(page);
  const headers = { Origin: "http://localhost:3000" };
  const created = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Everyday",
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents: 500000,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  const categoryId = snapshot.categories.find(
    (c: { name: string }) => c.name === "Groceries",
  ).id;
  for (const [kind, amountCents, description] of [
    ["income", 200000, "Salary"],
    ["expense", 12050, "Groceries"],
    ["refund", 2050, "Returned groceries"],
  ] as const) {
    const response = await page.request.post("/api/transactions", {
      headers,
      data: {
        accountId: id,
        kind,
        amountCents,
        description,
        date: today(),
        categoryId: kind === "income" ? null : categoryId,
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto("/plan");
  await page.getByRole("button", { name: "Set budget" }).click();
  await choose(
    page,
    page.getByRole("combobox", { name: "Category", exact: true }),
    "Groceries",
  );
  await page.getByLabel("Allowance (AUD)").fill("700");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/net-worth");
  await expect(
    page.getByText("$6,900.00", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Everything, in balance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Household forecast/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/overview-" + info.project.name + ".png",
    fullPage: true,
  });
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.goto("/documentation");
  await expect(page.getByText("Your household, in balance")).toBeVisible();
});

test("held CSV response keeps review unavailable until mapping is ready @timing", async ({
  page,
}) => {
  await session(page);
  await account(page);
  await page.goto("/imports");
  await choose(page, page.getByLabel("Import into"), "Everyday");
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached!: () => void;
  const requested = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await page.route("**/api/imports/headers", async (route) => {
    reached();
    await barrier;
    await route.continue();
  });
  try {
    await page.getByLabel("Choose bank CSV").setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Description,Amount\n01/09/2026,Test,-1"),
    });
    await requested;
    await expect(page.getByLabel("Choose bank CSV")).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Reading CSV…");
    await expect(
      page.getByRole("button", { name: "Review transactions" }),
    ).toHaveCount(0);
    release();
    await expect(
      page.getByRole("button", { name: "Review transactions" }),
    ).toBeEnabled();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("scheduled bills can be matched once and forecast assumptions are visible", async ({
  page,
}) => {
  await session(page);
  await account(page);
  const db = await database();
  const a = await db.account.findFirstOrThrow();
  await db.schedule.create({
    data: {
      name: "Internet",
      accountId: a.id,
      kind: "expense",
      amountCents: 8000n,
      startDate: today(),
      frequency: "monthly",
      subscription: true,
      provider: "Provider",
    },
  });
  await db.$disconnect();
  await page.goto("/plan?tab=subscriptions");
  await page
    .getByRole("button", { name: "Subscriptions", exact: true })
    .click();
  await expect(
    page.getByText("Internet", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Record", exact: true }).first(),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(page.getByText(/Monthly budget allowances/)).toBeVisible();
});

test("keyboard focus returns after cancelling a form", async ({ page }) => {
  await session(page);
  await page.goto("/accounts");
  const trigger = page.getByRole("button", {
    name: "Add account",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByLabel("Would you like to upload a statement to start?"),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Account name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("receipt preview, download and recoverable storage failures", async ({
  page,
}) => {
  await session(page);
  await account(page);
  const db = await database();
  const a = await db.account.findFirstOrThrow();
  const transaction = await db.transaction.create({
    data: {
      accountId: a.id,
      kind: "expense",
      amountCents: -1500n,
      date: today(),
      description: "Receipt journey",
    },
  });
  await db.$disconnect();
  const receipt = {
    id: "00000000-0000-4000-8000-000000000001",
    transactionId: transaction.id,
    filename: "receipt.png",
    mimeType: "image/png",
    size: 68,
    createdAt: new Date().toISOString(),
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0iMAAAAASUVORK5CYII=",
    "base64",
  );
  let attached = false;
  let attempts = 0;
  let deletions = 0;
  // Storage responses are UI fixtures; actual authentication, magic checking and compensation are covered in database integration tests.
  await page.route(
    "**/api/transactions/" + transaction.id + "/receipts",
    async (route) => {
      if (route.request().method() === "POST") {
        attempts++;
        if (attempts === 1) {
          await route.fulfill({
            status: 503,
            json: { error: "Storage unavailable. Try again." },
          });
          return;
        }
        attached = true;
        await route.fulfill({ json: receipt });
      } else await route.fulfill({ json: attached ? [receipt] : [] });
    },
  );
  await page.route("**/api/receipts/" + receipt.id + "/content*", (route) =>
    route.fulfill({
      body: png,
      contentType: "image/png",
      headers: route.request().url().includes("download=1")
        ? { "Content-Disposition": 'attachment; filename="receipt.png"' }
        : {},
    }),
  );
  await page.route("**/api/receipts/" + receipt.id, async (route) => {
    deletions++;
    if (deletions === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Storage unavailable. Try again." },
      });
    else {
      attached = false;
      await route.fulfill({ json: { ok: true } });
    }
  });
  await page.goto("/transactions?detail=" + transaction.id);
  await expect(page.getByRole("dialog")).toBeVisible();
  const file = { name: "receipt.png", mimeType: "image/png", buffer: png };
  await page.getByLabel("Attach receipt").setInputFiles(file);
  await expect(page.getByText("Storage unavailable. Try again.")).toBeVisible();
  await page.getByLabel("Attach receipt").setInputFiles(file);
  await expect(
    page.getByRole("img", { name: "Receipt receipt.png" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download/ }).click();
  expect((await download).suggestedFilename()).toBe("receipt.png");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete receipt receipt.png" })
    .click();
  await expect(
    page.getByRole("img", { name: "Receipt receipt.png" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete receipt receipt.png" })
    .click();
  await expect(
    page.getByRole("img", { name: "Receipt receipt.png" }),
  ).toHaveCount(0);
});
