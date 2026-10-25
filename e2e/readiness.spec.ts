import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect, session, database } from "./fixtures";

test("Users shows account details and confirms access resets and deletions", async ({
  page,
}) => {
  await session(page);
  const db = await database();
  const memberId = randomUUID();
  await db.user.create({
    data: {
      id: memberId,
      name: "Anna",
      email: "anna@example.test",
      role: "member",
      state: "active",
    },
  });
  await db.user.create({
    data: {
      id: randomUUID(),
      name: "Invitee",
      email: "invitee@example.test",
      role: "member",
      state: "invited",
    },
  });
  await page.goto("/settings/users");
  for (const [name, email, role, state] of [
    ["Voytek", "voytek@example.test", "Admin", "active"],
    ["Anna", "anna@example.test", "Member", "active"],
    ["Invitee", "invitee@example.test", "Member", "invited"],
  ]) {
    const row = page
      .locator(".divide-y > div")
      .filter({ has: page.getByText(email!, { exact: true }) });
    await expect(row.getByText(name!, { exact: true })).toBeVisible();
    await expect(row.getByText(state!, { exact: true })).toBeVisible();
    await expect(
      row.getByRole("combobox", { name: "Role for " + name }),
    ).toHaveText(role!);
  }
  // Dismissing confirmation must finish without mutating the stored account.
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "All their passkeys and sessions will be revoked",
    );
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Reset access for Anna" }).click();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: memberId } })).state,
  ).toBe("active");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset access for Anna" }).click();
  await expect(
    page.getByRole("textbox", { name: "Invitation link" }),
  ).toBeVisible();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: memberId } })).state,
  ).toBe("recovering");
  await page.getByRole("button", { name: "Close dialog" }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "Their access will be revoked. Financial history will be preserved.",
    );
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Delete Anna", exact: true }).click();
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: memberId } })).state,
  ).toBe("recovering");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Anna", exact: true }).click();
  await expect(
    page.getByText("anna@example.test", { exact: true }),
  ).toHaveCount(0);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: memberId } })).state,
  ).toBe("deleted");
  await db.$disconnect();
});

test("System displays the metadata embedded in the application build", async ({
  page,
}) => {
  await session(page);
  const metadata = JSON.parse(fs.readFileSync("build-metadata.json", "utf8"));
  await page.goto("/settings/system");
  for (const [label, key] of [
    ["Version", "version"],
    ["Release Tag", "releaseTag"],
    ["Build Commit", "buildCommit"],
    ["Build Time", "buildTime"],
  ]) {
    const row = page
      .locator("dl > div")
      .filter({ has: page.getByText(label!, { exact: true }) });
    await expect(row.locator("dd")).toHaveText(metadata[key!]);
  }
});
