import { test, expect, choose } from "./fixtures";
import { seed } from "./ux-fixtures";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";
test("inline save failure retains the selected category and retries without leaving the row @timing @ux-timing", async ({
  page,
}) => {
  await page.clock.install();
  const { db, food } = await seed(page);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/transactions/bulk-category", async (route) => {
    if (fail) {
      await barrier;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary save failure" }),
      });
    } else await route.continue();
  });
  try {
    await page.goto("/transactions?search=Flow+purchase+000");
    const row = page
      .locator("tr")
      .filter({ has: page.getByText("Flow purchase 000", { exact: true }) });
    const category = row
      .getByRole("combobox", {
        name: "Category for Flow purchase 000",
        exact: true,
      })
      .filter({ visible: true });
    const failed = page.waitForResponse((r) =>
      r.url().endsWith("/api/transactions/bulk-category"),
    );
    await choose(page, category, "Groceries");
    await expect(category).toBeDisabled();
    await expect(
      row.getByText("Saving…", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    release();
    expect((await failed).status()).toBe(503);
    await expect(category).toContainText("Groceries");
    await expect(row.getByRole("alert").filter({ visible: true })).toHaveText(
      "Temporary save failure",
    );
    fail = false;
    const saved = page.waitForResponse((r) =>
      r.url().endsWith("/api/transactions/bulk-category"),
    );
    await row
      .getByRole("button", { name: "Retry save", exact: true })
      .filter({ visible: true })
      .click();
    expect((await saved).ok()).toBe(true);
    await expect(
      row.getByText("Saved", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    expect(
      (
        await db.transaction.findFirstOrThrow({
          where: { description: "Flow purchase 000" },
        })
      ).categoryId,
    ).toBe(food.id);
  } finally {
    release();
    await page.unroute("**/api/transactions/bulk-category");
    await db.$disconnect();
  }
});

test("statement review status filters keep corrections reachable and the action bar visible", async ({
  page,
}, info) => {
  const { db, accounts } = await seed(page);
  try {
    const result = await page.request.post("/api/statements", {
      headers: { Origin: "http://localhost:3000" },
      multipart: {
        accountId: accounts[0].id,
        file: {
          name: "review-flow.pdf",
          mimeType: "application/pdf",
          buffer: statementPdf([
            [
              "Statement",
              "Date Details Amount",
              "12 Oct Shop -20.00",
              "13 Oct Other -10.00",
            ],
          ]),
        },
      },
    });
    expect(result.ok()).toBe(true);
    const statement = await result.json();
    // The actual PDF worker and database complete independently of browser timers.
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/statements/${statement.id}`)
            ).json()
          ).status,
      )
      .toBe("ready");
    await page.goto("/");
    await page
      .getByRole("button", { name: "1 statements to review", exact: true })
      .click();
    await page.getByRole("link", { name: /review-flow.pdf/ }).click();
    await page
      .getByRole("button", { name: "2. Review transactions", exact: true })
      .click();
    const statuses = page.getByRole("group", {
      name: "Review status",
      exact: true,
    });
    await statuses
      .getByRole("button", { name: "Needs attention (2)", exact: true })
      .click();
    await expect(page.getByRole("article")).toHaveCount(2);
    await statuses
      .getByRole("button", { name: "Ready (0)", exact: true })
      .click();
    await expect(
      page.getByText("No transactions in this view.", { exact: false }),
    ).toBeVisible();
    await statuses
      .getByRole("button", { name: "All (2)", exact: true })
      .click();
    await page.getByLabel("Year for invalid statement dates").fill("2026");
    await page
      .getByRole("button", { name: "Apply year to invalid dates", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Include row 1", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/ux-import-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await db.$disconnect();
  }
});
