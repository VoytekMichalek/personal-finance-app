import { test, expect, session } from "./fixtures";
import {
  statementPdf,
  sixMonthStatement,
} from "../apps/api/src/integration/statement-fixture";
test("statement stays saved when leaving processing and returning to review @statement-background", async ({
  page,
}) => {
  await page.clock.install();
  await session(page);
  const created = await page.request.post("/api/accounts", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      name: "Background statement",
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents: 0,
    },
  });
  const account = await created.json();
  // Hold the progress response while the real server worker proceeds independently.
  let releaseProgress!: () => void;
  const progressBarrier = new Promise<void>((resolve) => {
    releaseProgress = resolve;
  });
  await page.route(/\/api\/statements\/[a-f0-9-]+$/, async (route) => {
    await progressBarrier;
    await route.continue();
  });
  try {
    await page.goto("/accounts/" + account.id + "/statement");
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/statements") && r.request().method() === "POST",
    );
    await page.getByLabel("PDF statement", { exact: true }).setInputFiles({
      name: "background.pdf",
      mimeType: "application/pdf",
      buffer: statementPdf(sixMonthStatement()),
    });
    const response = await uploaded;
    expect(response.status()).toBe(202);
    const saved = await response.json();
    await expect(
      page.getByText("Your statement is saved.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Back to account", exact: true })
      .click();
    await expect(
      page.getByText("background.pdf", { exact: true }),
    ).toBeVisible();
    await page.goto("/");
    // Real worker/database boundary: wait for persisted completion, not a timer guess.
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/statements/" + saved.id)).json())
            .status,
      )
      .toBe("ready");
    releaseProgress();
    await page.goto("/accounts/" + account.id + "?tab=statements");
    await page.reload();
    await expect(
      page.getByText("Ready to review", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Review", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Start with the right balance",
        exact: true,
      }),
    ).toBeVisible();
    const snapshot = await (await page.request.get("/api/snapshot")).json();
    expect(snapshot.transactions).toHaveLength(0);
  } finally {
    releaseProgress();
  }
});
