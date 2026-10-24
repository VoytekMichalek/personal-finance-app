import { test, expect, session, choose } from "./fixtures";
test("AI settings save and replace a private key, persist the model, and remove the key", async ({
  page,
}) => {
  await session(page);
  await page.goto("/settings/ai");
  await expect(
    page.getByRole("heading", { name: "AI assistance" }),
  ).toBeVisible();
  const key = page.getByLabel("OpenRouter API key");
  await expect(key).toHaveAttribute("type", "password");
  await key.fill("synthetic-browser-key");
  await choose(
    page,
    page.getByRole("combobox", { name: "AI model" }),
    "Luna Latest",
  );
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByRole("status")).toHaveText("AI settings saved.");
  await expect(key).toHaveValue("");
  await page.reload();
  await expect(key).toHaveAttribute(
    "placeholder",
    "Key saved — leave blank to keep it",
  );
  await expect(page.getByRole("combobox", { name: "AI model" })).toHaveText(
    "Luna Latest",
  );
  await key.fill("synthetic-browser-replacement");
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByRole("status")).toHaveText("AI settings saved.");
  await page.getByRole("button", { name: "Remove saved key" }).click();
  await expect(key).toHaveAttribute(
    "placeholder",
    "Paste your OpenRouter API key",
  );
  await expect(page.getByRole("button", { name: "Check key" })).toBeDisabled();
});
test("compact desktop sidebar fits laptop heights expanded and collapsed", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Mobile uses its own header and bottom navigation.",
  );
  await session(page);
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto("/settings/ai");
  const sidebar = page.getByRole("complementary", {
    name: "Primary navigation",
  });
  await expect(
    sidebar.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  const expectFits = async () => {
    expect(
      await sidebar.evaluate(
        (element) => element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true);
    await expect(
      sidebar.getByRole("link", { name: "Produced by Codename" }),
    ).toBeInViewport();
  };
  await expectFits();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await expectFits();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Collapse sidebar" }),
  ).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "240px");
  await expect(sidebar.locator(".sidebar-header .sidebar-label")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: "artifacts/compact-sidebar-desktop.png" });
});
