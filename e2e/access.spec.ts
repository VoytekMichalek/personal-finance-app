import { test, expect, database, environment } from "./fixtures";

test("real passkey bootstrap, spouse invitation, sign-in and logout", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP virtual authenticator exercises real WebAuthn on Chromium; mobile financial journeys use real signed sessions.",
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const options = {
    protocol: "ctap2" as const,
    transport: "internal" as const,
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  };
  const primary = await cdp.send("WebAuthn.addVirtualAuthenticator", { options });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Two simultaneous completion requests must create exactly one first admin.
  await page.route(
    "**/api/auth/passkey/verify-registration",
    async (route) => {
      const replies = await Promise.all([route.fetch(), route.fetch()]);
      expect(replies.filter((reply) => reply.ok())).toHaveLength(1);
      expect(replies.every((reply) => reply.status() < 500)).toBe(true);
      await route.fulfill({ response: replies.find((reply) => reply.ok())! });
    },
    { times: 1 },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Create first admin" }).click();
  await page.getByLabel("Your name").fill("Voytek");
  await page.getByLabel("Email", { exact: true }).fill("voytek@example.test");
  await page
    .getByLabel("First-user token")
    .fill(environment().FIRST_USER_TOKEN);
  await page.getByRole("button", { name: "Create first admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Everything, in balance." }),
  ).toBeVisible();
  const db = await database();
  expect(
    await db.user.count({ where: { role: "admin", state: "active" } }),
  ).toBe(1);
  expect(await db.passkey.count()).toBe(1);
  expect(
    (await db.setup.findUniqueOrThrow({ where: { id: 1 } })).completedAt,
  ).not.toBeNull();
  await db.$disconnect();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Manage passkeys" }).click();
  // Use a different device: WebAuthn excludes credentials already registered
  // for this user, so the primary authenticator cannot register itself again.
  await cdp.send("WebAuthn.removeVirtualAuthenticator", primary);
  const backup = await cdp.send("WebAuthn.addVirtualAuthenticator", { options });
  await page.getByLabel("New passkey name").fill("Backup device");
  const registered = page.waitForResponse(
    (response) => response.url().endsWith("/passkey/verify-registration"),
  );
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  expect((await registered).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Remove Backup device" }),
  ).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Remove this passkey?");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Remove Backup device" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Backup device" }),
  ).toHaveCount(0);
  const lastKey = page
    .getByRole("dialog")
    .getByRole("button", { name: /^Remove / });
  await expect(lastKey).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await lastKey.click();
  await expect(
    page.getByText("Add a replacement passkey before removing your last one."),
  ).toBeVisible();
  await expect(lastKey).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/settings/users");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Anna");
  await page.getByLabel("Email", { exact: true }).fill("anna@example.test");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(
    page.getByRole("heading", { name: "An invitation, just for them." }),
  ).toBeVisible();
  const link = await page
    .getByRole("textbox", { name: "Invitation link" })
    .inputValue();
  await page.getByRole("button", { name: "Copy invite link" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(link);
  await context.clearCookies();
  // The invited person uses their own device, without the removed backup key.
  await cdp.send("WebAuthn.removeVirtualAuthenticator", backup);
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options });
  await page.goto(link);
  await page.getByRole("button", { name: "Create passkey" }).click();
  await expect(
    page.getByRole("heading", { name: "Everything, in balance." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with a passkey" }),
  ).toBeVisible();
  expect((await page.request.get("/api/snapshot")).status()).toBe(401);
  await page.goto("/settings/users");
  await expect(
    page.getByRole("button", { name: "Sign in with a passkey" }),
  ).toBeVisible();
  const signedIn = page.waitForResponse(
    (response) => response.url().endsWith("/passkey/verify-authentication"),
  );
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  expect((await signedIn).status()).toBe(200);
  expect((await (await page.request.get("/api/access/me")).json()).email).toBe(
    "anna@example.test",
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Everything, in balance." }),
  ).toBeVisible();
});
