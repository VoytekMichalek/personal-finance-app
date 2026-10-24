import { test, expect, session, choose, chooseDate } from "./fixtures";
import {
  statementPdf,
  sixMonthStatement,
} from "../apps/api/src/integration/statement-fixture";
test("statement setup reads six months, accepts suggestions and opens the account page", async ({
  page,
}, info) => {
  await session(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page
    .getByLabel("Would you like to upload a statement to start?")
    .check();
  await page.getByLabel("Account name").fill("CBA Everyday");
  await choose(
    page,
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Bank account",
  );
  await page.getByRole("button", { name: "Continue to statement" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload statement" }),
  ).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/statements") && r.request().method() === "POST",
  );
  await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
    name: "six-months.pdf",
    mimeType: "application/pdf",
    buffer: statementPdf(sixMonthStatement()),
  });
  expect((await response).status()).toBe(202);
  await expect(
    page.getByText("6 pages read · 12 transaction lines", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Statement opening balance (AUD)")).toHaveValue(
    "1000.00",
  );
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await expect(
    page.getByLabel("Category row 2", { exact: true }),
  ).toContainText("Subscriptions");
  await page
    .getByRole("button", { name: "3. Recurring suggestions", exact: true })
    .click();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
  await expect(page.getByText("1 recurring items accepted")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept & import statement" }).click();
  await expect(
    page.getByRole("heading", { name: "Statement imported" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View account" }).click();
  await expect(
    page.getByRole("heading", { name: "CBA Everyday" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/account-detail-" + info.project.name + ".png",
    fullPage: true,
  });
});
test("statement account detail includes forecast, original downloads and net worth", async ({
  page,
}, info) => {
  await session(page);
  const created = await page.request.post("/api/accounts", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      name: "CBA Everyday",
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents: 100000,
    },
  });
  const account = await created.json();
  expect(created.ok()).toBe(true);
  const upload = await page.request.post("/api/statements", {
    headers: { Origin: "http://localhost:3000" },
    multipart: {
      accountId: account.id,
      file: {
        name: "six-months.pdf",
        mimeType: "application/pdf",
        buffer: statementPdf(sixMonthStatement()),
      },
    },
  });
  const queued = await upload.json();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/statements/" + queued.id)).json())
          .status,
    )
    .toBe("ready");
  const preview = await (
    await page.request.get("/api/statements/" + queued.id)
  ).json();
  expect(upload.ok()).toBe(true);
  const commit = await page.request.post(
    "/api/statements/" + preview.id + "/commit",
    {
      headers: { Origin: "http://localhost:3000" },
      data: {
        rows: preview.rows,
        opening: preview.details.opening,
        applyOpening: true,
        reviewed: true,
        schedules: preview.details.recurring.slice(0, 1),
      },
    },
  );
  expect(commit.ok()).toBe(true);
  await page.goto("/accounts/" + account.id);
  await expect(
    page.getByText("$18,880.00", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/account-detail-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Upcoming & forecast" }).click();
  await expect(
    page.getByRole("img", {
      name: "Account forecast from accepted scheduled bills and income",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Statements", exact: true }).click();
  await expect(page.getByText("six-months.pdf", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("six-months.pdf");
  await page.goto("/net-worth");
  await expect(page.getByRole("link", { name: /CBA Everyday/ })).toContainText(
    "$18,880.00",
  );
  await page.getByRole("link", { name: "Manage assets & liabilities" }).click();
  await expect(
    page.getByRole("heading", { name: "Assets & Liabilities", exact: true }),
  ).toBeVisible();
});
test("category hierarchy, styled keyboard dropdown and sidebar branding", async ({
  page,
}, info) => {
  await session(page);
  await page.goto("/settings/categories");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Streaming");
  const parent = page.getByRole("combobox", { name: "Parent category" });
  await parent.focus();
  await parent.press("ArrowDown");
  await page
    .getByRole("option", { name: "Subscriptions", exact: true })
    .click();
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(
    page.getByRole("button", { name: /Subscriptions \/ Streaming/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Subscriptions \/ Streaming/ })
    .click();
  const removed = page.waitForResponse(
    (r) =>
      r.url().includes("/api/categories/") && r.request().method() === "DELETE",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove category" }).click();
  await removed;
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Subscriptions \/ Streaming/ }),
  ).toHaveCount(0);
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const attribution = page.getByRole("link", {
      name: "Produced by Codename",
    });
    await expect(
      attribution.locator('img[src="/images/codename-icon-acid.svg"]'),
    ).toHaveCSS("opacity", "1");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(attribution.locator(".sidebar-attribution-full")).toHaveCSS(
      "opacity",
      "1",
    );
  } else {
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Produced by Codename" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  }
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
});

test("credit card setup shows debt and includes it once in net worth", async ({
  page,
}) => {
  await session(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByLabel("Account name").fill("CBA Card");
  await choose(
    page,
    page.getByRole("combobox", { name: "Type", exact: true }),
    "Credit card",
  );
  await expect(
    page.getByText("Track this card separately", { exact: false }),
  ).toBeVisible();
  await chooseDate(page, page.getByLabel("Opening date"), "2026-01-01");
  await page.getByLabel("Opening balance (AUD)").fill("-500");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: /CBA Card/ }).click();
  await expect(
    page.getByText("Credit card · $500.00 owed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Upload statement" }),
  ).toBeVisible();
  await page.goto("/net-worth");
  await expect(page.getByRole("link", { name: /CBA Card/ })).toContainText(
    "-$500.00",
  );
});
