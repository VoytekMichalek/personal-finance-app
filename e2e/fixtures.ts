import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type Page,
  type Locator,
} from "@playwright/test";
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } =
  require("@prisma/client") as typeof import("../apps/api/node_modules/@prisma/client");
export function environment() {
  return JSON.parse(
    fs.readFileSync("artifacts/e2e-environment.json", "utf8"),
  ) as {
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    FIRST_USER_TOKEN: string;
  };
}
export async function database() {
  const env = environment();
  if (!new URL(env.DATABASE_URL).pathname.endsWith("/finance_e2e"))
    throw new Error("Unsafe E2E database");
  return new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
}
export async function reset() {
  const db = await database();
  await db.$executeRawUnsafe(
    'TRUNCATE "Receipt", "Transaction", "ImportBatch", "ImportMapping", "Budget", "Rule", "Schedule", "Valuation", "Asset", "Category", "Account", "AuditEvent", "RegistrationGrant", "Passkey", "Session", "AuthAccount", "Verification", "User", "Setup" CASCADE',
  );
  // Restore the seeded category baseline too: review-created categories must not
  // accumulate across repeat runs and change the next journey's dropdowns.
  const categorySeed = fs.readFileSync(
    new URL(
      "../apps/api/prisma/migrations/20261003052000_starter_categories/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const statement of categorySeed.split(";").filter((sql) => sql.trim()))
    await db.$executeRawUnsafe(statement);
  await db.setup.create({ data: { id: 1 } });
  await db.$disconnect();
}
export async function session(page: Page) {
  const db = await database();
  const id = randomUUID();
  const token = randomUUID();
  await db.user.create({
    data: {
      id,
      name: "Voytek",
      email: "voytek@example.test",
      role: "admin",
      state: "active",
    },
  });
  await db.setup.update({
    where: { id: 1 },
    data: { completedAt: new Date() },
  });
  await db.session.create({
    data: {
      id: randomUUID(),
      userId: id,
      token,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await db.$disconnect();
  const { makeSignature } = await import(
    "../apps/api/node_modules/better-auth/dist/crypto/index.mjs"
  );
  const signature = await makeSignature(
    token,
    environment().BETTER_AUTH_SECRET,
  );
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: encodeURIComponent(token + "." + signature),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return id;
}
export const test = base.extend({
  page: async ({ page }, use) => {
    await reset();
    page.on("pageerror", (error) =>
      console.error("Browser error:", error.name, error.message),
    );
    await use(page);
  },
});
export { expect };
export async function account(page: Page, name = "Everyday", balance = "5000") {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account name").fill(name);
  await chooseDate(page, dialog.getByLabel("Opening date"), "2026-01-01");
  await dialog.getByLabel("Opening balance (AUD)").fill(balance);
  await dialog
    .getByRole("button", { name: "Add account", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: new RegExp(name) }),
  ).toBeVisible();
}

export async function choose(page: Page, locator: Locator, label: string) {
  await locator.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

export async function chooseDate(page: Page, locator: Locator, date: string) {
  await locator.click();
  const yearPicker = page.getByRole("combobox", { name: "Year", exact: true });
  if ((await yearPicker.textContent())?.trim() !== date.slice(0, 4))
    await choose(page, yearPicker, date.slice(0, 4));
  const month = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
  const monthPicker = page.getByRole("combobox", {
    name: "Month",
    exact: true,
  });
  if ((await monthPicker.textContent())?.trim() !== month)
    await choose(page, monthPicker, month);
  const label = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
  await page.getByRole("button", { name: label, exact: true }).click();
}

export async function tickFilter(page: Page, name: string, labels: string[]) {
  const trigger = page.getByRole("button", { name, exact: true });
  await trigger.click();
  for (const label of labels) {
    const option = page.getByRole("menuitemcheckbox", {
      name: label,
      exact: true,
    });
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
}
