import { test, expect, session, account, chooseDate } from "./fixtures";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";
import { readFileSync } from "node:fs";

const releases: { version: string }[] = JSON.parse(
  readFileSync("docs/releases.json", "utf8"),
);

// The barrier controls pending state; real API/database completion owns persistence.
test("@timing form failure keeps entered values and refresh recovers without replaying a write", async ({
  page,
}, info) => {
  await page.clock.install();
  await session(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account name").fill("Preserved account");
  await chooseDate(page, dialog.getByLabel("Opening date"), "2026-01-01");
  await dialog.getByLabel("Opening balance (AUD)").fill("123.45");
  let writes = 0;
  await page.route("**/api/accounts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    if (writes === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "The server could not save this account. Try again.",
        }),
      });
    return route.continue();
  });
  await dialog
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("could not save");
  await expect(dialog.getByLabel("Account name")).toHaveValue(
    "Preserved account",
  );
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let hold = true;
  await page.route("**/api/snapshot", async (route) => {
    if (hold) await barrier;
    return route.continue();
  });
  const refresh = page.waitForResponse(
    (r) => r.url().endsWith("/api/snapshot") && r.ok(),
  );
  try {
    await dialog.getByRole("button", { name: "Refresh data" }).click();
    await expect(
      dialog.getByRole("button", { name: "Refreshing…" }),
    ).toBeDisabled();
    expect(writes).toBe(1);
  } finally {
    hold = false;
    release();
  }
  await refresh;
  await expect(dialog.getByRole("status")).toContainText("Data refreshed");
  await expect(dialog.getByLabel("Opening balance (AUD)")).toHaveValue(
    "123.45",
  );
  await page.screenshot({
    path: `artifacts/form-error-recovery-${info.project.name}.png`,
    fullPage: true,
  });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(writes).toBe(2);
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  expect(snapshot.accounts).toHaveLength(1);
  expect(snapshot.accounts[0]).toMatchObject({
    name: "Preserved account",
    openingBalanceCents: 12345,
  });
});

test("a failed PDF upload can retry the retained file with corrected options", async ({
  page,
}) => {
  await session(page);
  await account(page);
  const data = await (await page.request.get("/api/snapshot")).json();
  await page.goto(`/accounts/${data.accounts[0].id}/statement`);
  let fail = true;
  await page.route("**/api/statements", async (route) => {
    if (route.request().method() === "POST" && fail) {
      fail = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upload interrupted. Check AI settings or retry without AI.",
        }),
      });
    }
    return route.continue();
  });
  await page.getByLabel("PDF statement").setInputFiles({
    name: "retry.pdf",
    mimeType: "application/pdf",
    buffer: statementPdf([
      [
        "Household everyday statement for account ending 1234",
        "Transaction summary for your everyday bank account",
        "Date Details Amount",
        "12 Oct Local shop -20.00",
      ],
    ]),
  });
  await expect(page.getByRole("alert")).toContainText("Upload interrupted");
  await page.getByText("Reading options", { exact: true }).click();
  await page.getByLabel("Statement year (only if dates omit it)").fill("2026");
  const settingsOpened = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "AI settings (new tab)", exact: true })
    .click();
  const settings = await settingsOpened;
  await expect(settings).toHaveURL(/\/settings\/ai$/);
  await expect(
    settings.getByRole("heading", { name: "AI assistance", exact: true }),
  ).toBeVisible();
  await settings.close();
  await expect(
    page.getByLabel("Statement year (only if dates omit it)"),
  ).toHaveValue("2026");
  await page
    .getByRole("button", { name: "Retry PDF upload", exact: true })
    .click();
  await expect(page).toHaveURL(/\/statement\/[\w-]+$/);
  await expect(
    page.getByRole("button", { name: "2. Review transactions", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Transaction row 1", exact: true }),
  ).toContainText("12 Oct 2026");
  let failedDownload = false;
  await page.route("**/api/statements/*/file", async (route) => {
    if (!failedDownload) {
      failedDownload = true;
      return route.fulfill({
        status: 503,
        json: { error: "Source download unavailable. Try again." },
      });
    }
    return route.continue();
  });
  await page
    .getByRole("link", { name: "Download source PDF", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Source download unavailable",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download source PDF", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("retry.pdf");
});

test("release notes show every version and fit on a phone", async ({
  page,
}, info) => {
  await session(page);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Release notes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/releases$/);
  await expect(
    page.getByRole("heading", { name: "Release notes", exact: true }),
  ).toBeVisible();
  for (const release of releases)
    await expect(
      page.getByRole("heading", { name: `v${release.version}`, exact: true }),
    ).toBeVisible();
  const { version } = JSON.parse(readFileSync("build-metadata.json", "utf8"));
  const installedRelease = page
    .getByRole("heading", { name: `v${version}`, exact: true })
    .locator("..");
  await expect(
    installedRelease.getByText("This version", { exact: true }),
  ).toBeVisible();
  expect(
    await page.getByRole("link", { name: "Release details on GitHub" }).count(),
  ).toBe(releases.length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/release-history-${info.project.name}.png`,
  });
});
