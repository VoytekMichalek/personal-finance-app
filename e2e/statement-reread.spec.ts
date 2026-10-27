import { test, expect, session, database } from "./fixtures";
import {
  statementPdf,
  sixMonthStatement,
} from "../apps/api/src/integration/statement-fixture";

test("an empty saved review can be read again after confirmation @statement-reread", async ({
  page,
}, info) => {
  await page.clock.install();
  await session(page);
  const headers = { Origin: "http://localhost:3000" };
  const created = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Read again account",
      type: "bank",
      openingDate: "2026-01-01",
      openingBalanceCents: 100000,
    },
  });
  expect(created.ok()).toBe(true);
  const account = await created.json();
  const posted = await page.request.post("/api/transactions", {
    headers,
    data: {
      accountId: account.id,
      date: "2026-01-03",
      description: "Existing saved transaction",
      kind: "expense",
      amountCents: 500,
    },
  });
  expect(posted.ok()).toBe(true);
  const before = await (await page.request.get("/api/snapshot")).json();
  const upload = await page.request.post("/api/statements", {
    headers,
    multipart: {
      accountId: account.id,
      file: {
        name: "saved-review.pdf",
        mimeType: "application/pdf",
        buffer: statementPdf(sixMonthStatement()),
      },
    },
  });
  expect(upload.ok()).toBe(true);
  const queued = await upload.json();
  const endpoint = "/api/statements/" + queued.id;
  // The real worker and database complete independently of the browser clock.
  await expect
    .poll(async () => (await (await page.request.get(endpoint)).json()).status)
    .toBe("ready");
  const db = await database();
  try {
    const saved = await db.statement.findUniqueOrThrow({
      where: { id: queued.id },
    });
    // Simulate a persisted empty result from an older reader; keep its real PDF.
    await db.importBatch.update({
      where: { id: saved.importBatchId },
      data: { preview: [] },
    });
  } finally {
    await db.$disconnect();
  }
  await page.goto("/accounts/" + account.id + "/statement/" + queued.id);
  await expect(
    page.getByText("6 pages read · 0 transaction lines", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
  const reviewed = page.getByRole("checkbox");
  await reviewed.check();
  const readAgain = page.getByRole("button", {
    name: "Read again",
    exact: true,
  });
  await readAgain.click();
  const dialog = page.getByRole("dialog", {
    name: "Read this statement again?",
  });
  await expect(
    dialog.getByText("Your review edits and selections will be discarded.", {
      exact: false,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Keep current review" }).click();
  await expect(dialog).toBeHidden();
  await expect(readAgain).toBeFocused();
  await expect(reviewed).toBeChecked();
  expect((await (await page.request.get(endpoint)).json()).rows).toHaveLength(
    0,
  );

  let releaseRetry!: () => void, releaseProgress!: () => void;
  const retryGate = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  const progressGate = new Promise<void>((resolve) => {
    releaseProgress = resolve;
  });
  await page.route("**" + endpoint + "/retry", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ discardReview: true });
    const response = await route.fetch();
    await retryGate;
    await route.fulfill({ response });
  });
  await page.route("**" + endpoint, async (route) => {
    await progressGate;
    await route.continue();
  });
  try {
    await readAgain.click();
    await page.screenshot({
      path: `artifacts/statement-reread-${info.project.name}.png`,
    });
    const restarted = page.waitForResponse(
      (response) =>
        response.url().endsWith(endpoint + "/retry") &&
        response.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Discard review & read again" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Restarting reading…" }),
    ).toBeDisabled();
    releaseRetry();
    expect((await restarted).ok()).toBe(true);
    await expect(
      page.getByText("Your statement is saved.", { exact: false }),
    ).toBeVisible();
    await expect
      .poll(
        async () => (await (await page.request.get(endpoint)).json()).status,
      )
      .toBe("ready");
    releaseProgress();
    await page.clock.runFor(2000);
    await expect(
      page.getByText("6 pages read · 12 transaction lines", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    const after = await (await page.request.get("/api/snapshot")).json();
    expect(after.transactions).toEqual(before.transactions);
    expect(after.accounts).toEqual(before.accounts);
  } finally {
    releaseRetry();
    releaseProgress();
    await page.unrouteAll({ behavior: "wait" });
  }
});
