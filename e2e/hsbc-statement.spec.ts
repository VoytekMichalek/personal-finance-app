import { test, expect, session } from "./fixtures";
import { hsbcStatement } from "../apps/api/src/integration/hsbc-fixture";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";

test("HSBC grouped transactions survive upload, review, reload and import", async ({
  page,
}, info) => {
  await session(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page
    .getByLabel("Would you like to upload a statement to start?")
    .check();
  await page.getByLabel("Account name").fill("HSBC Everyday");
  await page.getByRole("button", { name: "Continue to statement" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload statement" }),
  ).toBeVisible();
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/statements") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
    name: "synthetic-hsbc.pdf",
    mimeType: "application/pdf",
    buffer: statementPdf(hsbcStatement()),
  });
  const response = await uploaded;
  expect(response.status()).toBe(202);
  const queued = await response.json();
  // Actual PDF worker/database completion owns readiness, not a browser timer.
  await expect(
    page.getByText("4 pages read · 9 transaction lines", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Statement opening balance (AUD)")).toHaveValue(
    "500.00",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Transaction row 5", exact: true }),
  ).toContainText("31 Dec 2025");
  await expect(
    page.getByLabel("Description row 4", { exact: true }),
  ).toHaveValue("Cafe Central AU");
  await expect(
    page.getByRole("checkbox", { name: "Include row 9", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("article", { name: "Transaction row 5", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/hsbc-review-${info.project.name}.png`,
  });
  await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /I have checked all statement pages/ })
    .check();
  const committed = page.waitForResponse(
    (result) =>
      result.url().endsWith(`/api/statements/${queued.id}/commit`) &&
      result.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Accept & import statement" }).click();
  expect((await committed).ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Statement imported" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View account" }).click();
  await expect(
    page.getByRole("heading", { name: "HSBC Everyday" }),
  ).toBeVisible();
  await expect(
    page.getByText("$601.10", { exact: true }).first(),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/statements/${queued.id}`)
  ).json();
  expect(saved.rows).toHaveLength(9);
  expect(saved.committedAt).toBeTruthy();
});
