import { test, expect, session, choose } from "./fixtures";
import { statementPdf } from "../apps/api/src/integration/statement-fixture";

for (const format of ["CSV", "PDF"]) {
  test(`${format} remembers categories across review pages and future uploads${format === "PDF" ? " @remember-pdf-timing" : ""}`, async ({
    page,
  }, info) => {
    await page.clock.install();
    await session(page);
    const headers = { Origin: "http://localhost:3000" };
    const created = await page.request.post("/api/accounts", {
      headers,
      data: {
        name: "Remember categories",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000,
      },
    });
    expect(created.ok()).toBe(true);
    const account = await created.json();
    const descriptions = Array.from({ length: 21 }, (_, i) =>
      i === 0 || i === 20 ? "Local Shop" : "Other purchase " + i,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    if (format === "PDF") {
      // The response barrier holds the processing view while the real worker reads.
      await page.route(/\/api\/statements\/[a-f0-9-]+$/, async (route) => {
        await gate;
        await route.continue();
      });
    }
    try {
      await page.goto(
        format === "PDF"
          ? `/accounts/${account.id}/statement`
          : `/imports?accountId=${account.id}`,
      );
      if (format === "CSV") {
        await choose(
          page,
          page.getByLabel("Import into"),
          "Remember categories",
        );
        await page
          .getByLabel("Choose bank CSV")
          .setInputFiles({
            name: "remember.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(
              "Date,Description,Amount\n" +
                descriptions
                  .map(
                    (description, i) =>
                      `2026-01-02,${description},-${i + 1}.00`,
                  )
                  .join("\n"),
            ),
          });
        await page
          .getByRole("button", { name: "Review transactions", exact: true })
          .click();
      } else {
        const uploaded = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/statements") &&
            response.request().method() === "POST",
        );
        await page
          .getByLabel("PDF statement", { exact: true })
          .setInputFiles({
            name: "remember.pdf",
            mimeType: "application/pdf",
            buffer: statementPdf([
              [
                "Bank statement 2026",
                "Opening balance 1000.00",
                ...descriptions.map(
                  (description, i) => `02/01/2026 ${description} -${i + 1}.00`,
                ),
                "Closing balance 769.00",
              ],
            ]),
          });
        const saved = await (await uploaded).json();
        await expect(
          page.getByText("Your statement is saved.", { exact: false }),
        ).toBeVisible();
        // Browser timers cannot advance native PDF extraction or database completion.
        await expect
          .poll(
            async () =>
              (
                await (
                  await page.request.get("/api/statements/" + saved.id)
                ).json()
              ).status,
          )
          .toBe("ready");
        release();
        await page.clock.runFor(2000);
        await expect(
          page.getByText("1 pages read · 21 transaction lines", {
            exact: false,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "2. Review transactions" })
          .click();
      }
      await choose(
        page,
        page.getByLabel("Category row 1", { exact: true }),
        "Dining",
      );
      await page.getByLabel("Remember category row 1", { exact: true }).check();
      expect(
        (await (await page.request.get("/api/snapshot")).json()).rules,
      ).toHaveLength(0);
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByLabel("Category row 21", { exact: true }),
      ).toHaveText("Dining");
      await expect(
        page.getByText("Auto categorised · remembered in this upload", {
          exact: true,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: `artifacts/remember-${format}-${info.project.name}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await page
        .getByLabel("Remember category row 1", { exact: true })
        .uncheck();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByLabel("Category row 21", { exact: true }),
      ).toHaveText("Uncategorised");
      await expect(
        page.getByText("Auto categorised · remembered in this upload", {
          exact: true,
        }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await page.getByLabel("Remember category row 1", { exact: true }).check();
      if (format === "PDF") {
        await page.getByRole("button", { name: "4. Confirm" }).click();
        await page
          .getByRole("checkbox", { name: /I have checked all statement pages/ })
          .check();
        await page
          .getByRole("button", { name: "Accept & import statement" })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Statement imported",
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await page
          .getByRole("button", { name: "Approve & import (21)" })
          .click();
        await expect(
          page.getByRole("heading", { name: "Import complete", exact: true }),
        ).toBeVisible();
      }
      const saved = await (await page.request.get("/api/snapshot")).json();
      expect(saved.rules).toHaveLength(1);
      expect(saved.rules[0]).toMatchObject({
        pattern: "local shop",
        matchMode: "exact",
      });
      expect(
        saved.transactions
          .filter(
            (row: { description: string }) => row.description === "Local Shop",
          )
          .map((row: { categoryId: string }) => row.categoryId),
      ).toEqual([saved.rules[0].categoryId, saved.rules[0].categoryId]);
      await page.goto("/imports");
      await choose(page, page.getByLabel("Import into"), "Remember categories");
      await page
        .getByLabel("Choose bank CSV")
        .setInputFiles({
          name: "future.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "Date,Description,Amount\n2026-02-01,LOCAL SHOP,-25.00",
          ),
        });
      await page
        .getByRole("button", { name: "Review transactions", exact: true })
        .click();
      await expect(
        page.getByLabel("Category row 1", { exact: true }),
      ).toHaveText("Dining");
      await expect(
        page.getByText("Auto categorised · saved rule", { exact: true }),
      ).toBeVisible();
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}
