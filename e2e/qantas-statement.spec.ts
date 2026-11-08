import { test, expect, session, choose } from "./fixtures";
import { qantasPdf } from "../apps/api/src/integration/qantas-fixture";

for (const incomplete of [false, true]) {
  test(`Qantas Pay review preserves AUD evidence and recovery, incomplete: ${incomplete}`, async ({
    page,
  }, info) => {
    await session(page);
    const funding = await page.request.post("/api/accounts", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        name: "Funding bank",
        type: "bank",
        openingDate: "2025-01-01",
        openingBalanceCents: 100000,
      },
    });
    expect(funding.ok()).toBe(true);
    await page.goto("/accounts");
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .click();
    await page
      .getByLabel("Would you like to upload a statement to start?")
      .check();
    await page.getByLabel("Account name").fill("Qantas Pay AUD");
    await page.getByRole("button", { name: "Continue to statement" }).click();
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/statements") &&
        response.request().method() === "POST",
    );
    await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
      name: "synthetic-qantas.pdf",
      mimeType: "application/pdf",
      buffer: qantasPdf(incomplete),
    });
    const response = await uploaded;
    expect(response.status()).toBe(202);
    const queued = await response.json();
    // Real PDF extraction and database completion determine readiness; no browser deadline is being tested.
    await expect(
      page.getByText("3 pages read · 5 transaction lines", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Statement opening balance (AUD)"),
    ).toHaveValue("500.00");
    await page.reload();
    await page
      .locator("summary")
      .filter({ hasText: "Source & reading notes" })
      .click();
    await expect(
      page.getByText(/Qantas Pay reloads are suggested as transfers/),
    ).toBeVisible();
    if (incomplete) {
      await expect(
        page.getByText(/has no matching dated transaction/),
      ).toBeVisible();
      await expect(
        page.getByText(
          /Opening balance plus extracted AUD transactions does not match/,
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .click();
      await expect(
        page.getByText(/Exchange rate 1.000000\s+-9.99 AUD/),
      ).toBeVisible();
      await page
        .getByText(/Exchange rate 1.000000\s+-9.99 AUD/)
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Read again", exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `artifacts/qantas-notes-${incomplete}-${info.project.name}.png`,
    });
    await page
      .getByRole("button", { name: "2. Review transactions", exact: true })
      .click();
    await expect(
      page.getByLabel("Description row 1", { exact: true }),
    ).toHaveValue("PURCHASE EXAMPLE GROCER BRISBANE QLD");
    await expect(page.getByLabel("Type row 2", { exact: true })).toContainText(
      "Refund",
    );
    await expect(
      page.getByRole("article", { name: "Transaction row 3", exact: true }),
    ).toContainText("$7.50");
    await choose(
      page,
      page.getByLabel("Transfer account row 4", { exact: true }),
      "Funding bank",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/qantas-review-${incomplete}-${info.project.name}.png`,
    });
    if (incomplete) {
      // Incomplete source evidence remains a review: no approval is performed.
      const snapshot = await (await page.request.get("/api/snapshot")).json();
      expect(snapshot.transactions).toEqual([]);
      return;
    }
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await page
      .getByRole("checkbox", { name: /I have checked all statement pages/ })
      .check();
    const committed = page.waitForResponse(
      (result) =>
        result.url().endsWith(`/api/statements/${queued.id}/commit`) &&
        result.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Accept & import statement" })
      .click();
    expect((await committed).ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Statement imported" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "View account" }).click();
    await expect(
      page.getByRole("heading", { name: "Qantas Pay AUD" }),
    ).toBeVisible();
    await expect(
      page.getByText("$563.41", { exact: true }).first(),
    ).toBeVisible();
  });
}
