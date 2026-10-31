import { test, expect, session, choose } from "./fixtures";

test("remembered rules retain exact matching when edited and can be paused", async ({
  page,
}) => {
  await session(page);
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  const dining = snapshot.categories.find(
    (category: { name: string }) => category.name === "Dining",
  );
  const created = await page.request.post("/api/rules", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      pattern: "local shop",
      matchMode: "exact",
      categoryId: dining.id,
      priority: 0,
    },
  });
  expect(created.ok()).toBe(true);
  await page.goto("/categories");
  await page.getByRole("button", { name: /Matches “local shop”/ }).click();
  const dialog = page.getByRole("dialog", { name: "Edit rule" });
  await expect(dialog.getByLabel("Match description")).toHaveText(
    "Exact description",
  );
  await choose(page, dialog.getByLabel("Assign category"), "Groceries");
  await dialog.getByLabel("Enable rule").uncheck();
  await dialog.getByRole("button", { name: "Save rule" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Matches “local shop”/ }),
  ).toContainText("Groceries · priority 0 · Paused");
  const after = await (await page.request.get("/api/snapshot")).json();
  expect(after.rules).toHaveLength(1);
  expect(after.rules[0]).toMatchObject({ matchMode: "exact", enabled: false });
});
