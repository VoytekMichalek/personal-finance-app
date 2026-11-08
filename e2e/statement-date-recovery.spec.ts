import { test, expect, session, choose, chooseDate } from "./fixtures";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";
import type { Page } from "@playwright/test";
const headers = { Origin: "http://localhost:3000" };

async function upload(
  page: Page,
  lines = ["12 Oct Shop -20.00", "13 Oct Other -10.00"],
) {
  await session(page);
  const response = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Date recovery",
      type: "bank",
      openingDate: "2024-01-01",
      openingBalanceCents: 100000,
    },
  });
  expect(response.ok()).toBe(true);
  const account = await response.json();
  const uploaded = await page.request.post("/api/statements", {
    headers,
    multipart: {
      accountId: account.id,
      file: {
        name: "missing-year.pdf",
        mimeType: "application/pdf",
        buffer: statementPdf([["Statement", "Date Details Amount", ...lines]]),
      },
    },
  });
  expect(uploaded.ok()).toBe(true);
  const saved = await uploaded.json();
  const endpoint = "/api/statements/" + saved.id;
  // The real PDF worker/database finish independently of browser time.
  await expect
    .poll(async () => (await (await page.request.get(endpoint)).json()).status)
    .toBe("ready");
  await page.goto(`/accounts/${account.id}/statement/${saved.id}`);
  return endpoint;
}

test("missing-year PDF dates recover in place after an error without losing categories @timing", async ({
  page,
}, info) => {
  await page.clock.install();
  const endpoint = await upload(page);
  const before = await (await page.request.get("/api/snapshot")).json();
  const dining = before.categories.find(
    (item: { name: string }) => item.name === "Dining",
  );
  for (const pattern of ["Shop", "Other"]) {
    const rule = await page.request.post("/api/rules", {
      headers,
      data: { pattern, categoryId: dining.id },
    });
    expect(rule.ok()).toBe(true);
  }
  await page.reload();
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await choose(
    page,
    page.getByRole("combobox", { name: "Category row 1", exact: true }),
    "Groceries",
  );
  const year = page.getByLabel("Year for invalid statement dates");
  await year.fill("2099");
  const failed = page.waitForResponse((response) =>
    response.url().endsWith(endpoint + "/dates"),
  );
  await page
    .getByRole("button", { name: "Apply year to invalid dates", exact: true })
    .click();
  expect((await failed).status()).toBe(400);
  await expect(
    page.getByRole("alert").filter({ hasText: "in the future" }).first(),
  ).toBeVisible();
  await expect(year).toBeEnabled();
  await expect(
    page.getByRole("article", { name: "Transaction row 2", exact: true }),
  ).not.toContainText("Row 1: the corrected date");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "desktop")
    await expect
      .poll(() =>
        page
          .getByRole("main")
          .evaluate((element) => element.getBoundingClientRect().left),
      )
      .toBe(240);
  await page
    .getByRole("heading", { name: /Fix statement dates/ })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/statement-date-error-${info.project.name}.png`,
  });
  await year.fill("2026");
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**" + endpoint + "/dates", async (route) => {
    await barrier;
    await route.continue();
  });
  try {
    const saved = page.waitForResponse((response) =>
      response.url().endsWith(endpoint + "/dates"),
    );
    await page
      .getByRole("button", { name: "Apply year to invalid dates", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Checking dates…", exact: true }),
    ).toBeDisabled();
    await expect(year).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "Include row 1", exact: true }),
    ).toBeDisabled();
    release();
    expect((await saved).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: /Fix statement dates/ }),
    ).toBeHidden();
    await expect(
      page.getByRole("combobox", { name: "Category row 1", exact: true }),
    ).toHaveText("Groceries");
    await expect(
      page.getByRole("combobox", { name: "Category row 2", exact: true }),
    ).toHaveText("Dining");
    await expect(
      page.getByRole("article", { name: "Transaction row 2", exact: true }),
    ).toContainText("Auto categorised · saved rule");
    await expect(
      page.getByRole("checkbox", { name: "Include row 1", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("article", { name: "Transaction row 1", exact: true }),
    ).toContainText("12 Oct 2026");
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await page
      .getByRole("checkbox", { name: /I have checked all statement pages/ })
      .check();
    const committed = page.waitForResponse((response) =>
      response.url().endsWith(endpoint + "/commit"),
    );
    await page
      .getByRole("button", { name: "Accept & import statement" })
      .click();
    expect((await committed).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Statement imported" }),
    ).toBeVisible();
    const snapshot = await (await page.request.get("/api/snapshot")).json();
    const row = snapshot.transactions.find(
      (item: { description: string }) => item.description === "Shop",
    );
    const groceries = snapshot.categories.find(
      (item: { name: string }) => item.name === "Groceries",
    );
    expect(row).toMatchObject({
      date: "2026-10-12",
      amountCents: -2000,
      categoryId: groceries.id,
    });
    expect(
      snapshot.transactions.find(
        (item: { description: string }) => item.description === "Other",
      ),
    ).toMatchObject({ categoryId: dining.id });
    await page.screenshot({
      path: `artifacts/statement-date-recovery-${info.project.name}.png`,
    });
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("a PDF spanning New Year lets each row choose its own date and persists corrections", async ({
  page,
}, info) => {
  const endpoint = await upload(page, [
    "31 Dec Shop -20.00",
    "01 Jan Other -10.00",
  ]);
  await page.getByText("Review individual dates (2)", { exact: true }).click();
  await page.getByRole("button", { name: "Fix row 1", exact: true }).click();
  await chooseDate(
    page,
    page.getByLabel("Correct date for row 1", { exact: true }),
    "2025-12-31",
  );
  const first = page.waitForResponse((response) =>
    response.url().endsWith(endpoint + "/dates"),
  );
  await page
    .getByRole("button", { name: "Save date for row 1", exact: true })
    .click();
  expect((await first).ok()).toBe(true);
  await chooseDate(
    page,
    page.getByLabel("Correct date for row 2", { exact: true }),
    "2026-01-01",
  );
  const second = page.waitForResponse((response) =>
    response.url().endsWith(endpoint + "/dates"),
  );
  await page
    .getByRole("button", { name: "Save date for row 2", exact: true })
    .click();
  expect((await second).ok()).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Transaction row 1", exact: true }),
  ).toContainText("31 Dec 2025");
  await expect(
    page.getByRole("article", { name: "Transaction row 2", exact: true }),
  ).toContainText("1 Jan 2026");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/statement-date-rows-${info.project.name}.png`,
    fullPage: true,
  });
});
