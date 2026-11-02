import {
  test,
  expect,
  session,
  choose,
  chooseDate,
  choosePeriod,
} from "./fixtures";
const headers = { Origin: "http://localhost:3000" };

for (const kind of ["asset", "liability"] as const) {
  test(`transfers to a ${kind} update its value, retain balanced history and stay out of cash and spending`, async ({
    page,
  }, info) => {
    await session(page);
    const bank = await (
      await page.request.post("/api/accounts", {
        headers,
        data: {
          name: "Everyday",
          type: "bank",
          openingDate: "2026-01-01",
          openingBalanceCents: 100000,
        },
      })
    ).json();
    await page.goto("/assets");
    await page.getByRole("button", { name: /Add asset/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Name", { exact: true })
      .fill(kind === "asset" ? "Share portfolio" : "Home loan");
    await choose(
      page,
      dialog.getByLabel("Type", { exact: true }),
      kind === "asset" ? "Asset" : "Liability",
    );
    await dialog.getByRole("button", { name: "Save details" }).click();
    await expect(dialog).toBeHidden();
    const data = await (await page.request.get("/api/snapshot")).json();
    const asset = data.assets[0];
    expect(asset.accountId).toBeTruthy();
    expect(
      (
        await page.request.put(`/api/assets/${asset.id}/valuations`, {
          headers,
          data: { date: "2026-10-01", amountCents: 50000 },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/assets/${asset.id}`);
    await page
      .getByRole("button", { name: "Record transfer", exact: true })
      .click();
    await choose(
      page,
      dialog.getByLabel("From account", { exact: true }),
      "Everyday",
    );
    await expect(
      dialog.getByLabel("To account", { exact: true }),
    ).toContainText(
      kind === "asset" ? "Share portfolio · Asset" : "Home loan · Liability",
    );
    await dialog.getByLabel("Amount (AUD)").fill("100");
    await chooseDate(
      page,
      dialog.getByLabel("Date", { exact: true }),
      "2026-10-02",
    );
    await dialog
      .getByRole("button", { name: "Record transfer", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByText(kind === "asset" ? "$600.00" : "$400.00", { exact: true })
        .first(),
    ).toBeVisible();
    const snapshot = await (await page.request.get("/api/snapshot")).json();
    expect(snapshot.transactions).toHaveLength(2);
    expect(
      snapshot.transactions.every(
        (row: { kind: string }) => row.kind === "transfer",
      ),
    ).toBe(true);
    expect(
      snapshot.transactions.reduce(
        (sum: number, row: { amountCents: number }) => sum + row.amountCents,
        0,
      ),
    ).toBe(0);
    await page.screenshot({
      path: `artifacts/asset-transfer-${kind}-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page
        .getByText(kind === "asset" ? "$600.00" : "$400.00", { exact: true })
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Update value", exact: true })
      .click();
    await chooseDate(page, dialog.getByLabel("Valuation date"), "2026-10-02");
    await dialog.getByLabel("Value (AUD)").fill("550");
    await dialog.getByRole("button", { name: "Save valuation" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("$550.00", { exact: true }).first(),
    ).toBeVisible();
    await page.goto("/accounts");
    await expect(page.getByText(asset.name, { exact: true })).toHaveCount(0);
    await page.goto(`/accounts/${bank.id}`);
    await expect(
      page.getByText("$900.00", { exact: true }).first(),
    ).toBeVisible();
    await page.goto("/expenses");
    await choosePeriod(page, "All history");
    await expect(
      page.getByRole("heading", {
        name: "Included transactions · 0",
        exact: true,
      }),
    ).toBeVisible();
  });
}
