import { test, expect } from "@playwright/test";

test("production sign-in omits the local demo shortcut even if metadata advertises it", async ({
  page,
}) => {
  await page.route("**/api/access/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Please sign in." } }),
  );
  await page.route("**/api/access/status", (route) =>
    route.fulfill({
      json: {
        bootstrapAvailable: true,
        bootstrapConfigured: true,
        demoLoginAvailable: true,
      },
    }),
  );
  await page.goto("/accounts");
  // This control proves that the status response has rendered before absence
  // is asserted; no timer or arbitrary settling delay is required.
  await expect(
    page.getByRole("button", { name: "Create first admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue as demo admin" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in with a passkey" }),
  ).toBeVisible();
});
