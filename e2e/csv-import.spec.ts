import { test, expect, session, account, database, choose } from "./fixtures";

const file = (csv: string) => ({
  name: "bank-export.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
});

test("split-column CSV suggests mappings, reviews and saves only after approval", async ({
  page,
}, info) => {
  await session(page);
  await account(page);
  await page.getByRole("button", { name: /Everyday/ }).click();
  await page.getByRole("link", { name: "Upload CSV" }).click();
  await expect(page.getByLabel("Import into")).toHaveText("Everyday");
  const csv =
    "Transaction Date;Details;Money Out;Money In\n2026-10-01;Groceries;19.99;\n2026-10-02;Salary;;500.01";
  await page.getByLabel("Choose bank CSV").setInputFiles(file(csv));
  await expect(page.getByLabel("Date", { exact: true })).toHaveText(
    "Transaction Date",
  );
  await expect(page.getByLabel("Debit (if separate)")).toHaveText("Money Out");
  await expect(page.getByLabel("Credit (if separate)")).toHaveText("Money In");
  await expect(page.getByLabel("Date format")).toHaveText(
    "Year-month-day (ISO)",
  );
  await expect(
    page.getByRole("button", { name: "Suggest with AI" }),
  ).toBeDisabled();
  await page.screenshot({
    path: `artifacts/csv-mapping-${info.project.name}.png`,
    fullPage: info.project.name === "mobile",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Review transactions" }).click();
  await expect(page.getByText("2 valid", { exact: false })).toBeVisible();
  await expect(
    page.getByText("2 selected · $500.01 money in · $19.99 money out"),
  ).toBeVisible();
  const db = await database();
  try {
    expect(await db.transaction.count()).toBe(0);
    await page.getByLabel("Include row 2").uncheck();
    await page.screenshot({
      path: `artifacts/csv-review-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Approve & import (1)" }).click();
    await expect(
      page.getByRole("heading", { name: "Import complete" }),
    ).toBeVisible();
    expect(await db.transaction.findMany()).toMatchObject([
      { amountCents: -1999n, description: "Groceries" },
    ]);
    await page.getByRole("button", { name: "Import another file" }).click();
    await page.getByLabel("Choose bank CSV").setInputFiles(file(csv));
    await page.getByRole("button", { name: "Review transactions" }).click();
    await expect(page.getByLabel("Include row 1")).not.toBeChecked();
    await expect(
      page.getByText("Possible duplicate · select to retain"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Change mapping" }).click();
    // Changing layout must not carry saved column names into an unrelated export.
    await page
      .getByLabel("Choose bank CSV")
      .setInputFiles(file("Date,Payee,Amount\n10/03/2026,Train,-4.50"));
    await expect(page.getByLabel("Description", { exact: true })).toHaveText(
      "Payee",
    );
    await expect(page.getByLabel("Signed amount")).toHaveText("Amount");
    await page.getByRole("link", { name: "Back to Everyday" }).click();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
    expect(await db.transaction.count()).toBe(1);
  } finally {
    await db.$disconnect();
  }
});

test("headerless CSV preserves its first transaction and supports reversed bank signs", async ({
  page,
}) => {
  await session(page);
  await account(page);
  await page.goto("/imports");
  await choose(page, page.getByLabel("Import into"), "Everyday");
  await page
    .getByLabel("Choose bank CSV")
    .setInputFiles(
      file("01/10/2026,19.99,COLES BRISBANE\n02/10/2026,-2.01,Returned item"),
    );
  await expect(
    page.getByLabel("First row contains column names"),
  ).not.toBeChecked();
  await expect(page.getByLabel("Date", { exact: true })).toHaveText("Column 1");
  await expect(page.getByLabel("Signed amount")).toHaveText("Column 2");
  await page.getByLabel("Reverse amount signs", { exact: false }).check();
  await page.getByRole("button", { name: "Review transactions" }).click();
  await expect(
    page.getByText("2 selected · $2.01 money in · $19.99 money out"),
  ).toBeVisible();
  await expect(page.getByLabel("Category row 1")).toHaveText("Groceries");
  await choose(page, page.getByLabel("Type row 2"), "Refund");
  await page.getByRole("button", { name: "Approve & import (2)" }).click();
  await expect(
    page.getByText("2 transactions imported", { exact: false }),
  ).toBeVisible();
  const db = await database();
  try {
    expect(
      await db.transaction.findMany({ orderBy: { sourceRow: "asc" } }),
    ).toMatchObject([
      {
        amountCents: -1999n,
        description: "COLES BRISBANE",
        date: "2026-10-01",
        kind: "expense",
      },
      {
        amountCents: 201n,
        description: "Returned item",
        date: "2026-10-02",
        kind: "refund",
      },
    ]);
  } finally {
    await db.$disconnect();
  }
});

test("long CSV column names stay inside mapping controls and open options", async ({
  page,
}, info) => {
  await session(page);
  await account(page);
  await page.goto("/imports");
  await choose(page, page.getByLabel("Import into"), "Everyday");
  const description =
    "Transaction description with a very long bank reference " +
    "MEADOWBROOKHOTEL".repeat(12);
  await page
    .getByLabel("Choose bank CSV")
    .setInputFiles(file(`Date,${description},Amount\n01/10/2026,COLES,-19.99`));
  const control = page.getByLabel("Description", { exact: true });
  await choose(page, control, description);
  await expect(control).toHaveText(description);
  expect(
    await control.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const parent = element.parentElement!.getBoundingClientRect();
      return (
        bounds.left >= parent.left &&
        bounds.right <= parent.right &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  await control.click();
  const option = page.getByRole("option", { name: description, exact: true });
  await expect(option).toBeVisible();
  expect(
    await option.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/csv-long-columns-${info.project.name}.png`,
    animations: "disabled",
  });
  await option.click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Review transactions" }).click();
  await expect(page.getByLabel("Category row 1")).toHaveText("Groceries");
});

test("CSV errors recover and manual mappings are used for unfamiliar headers", async ({
  page,
}) => {
  await session(page);
  await account(page);
  await page.goto("/imports");
  await choose(page, page.getByLabel("Import into"), "Everyday");
  await page
    .getByLabel("Choose bank CSV")
    .setInputFiles(file("Date,Amount,Amount\n01/10/2026,Shop,2"));
  await expect(page.getByRole("alert")).toContainText("non-empty and unique");
  await page
    .getByLabel("Choose bank CSV")
    .setInputFiles(
      file("When,What,Net\n10/21/2026,Train,-4.50\ninvalid,Broken,-1"),
    );
  await expect(page.getByRole("table", { name: "CSV sample" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await choose(page, page.getByLabel("Date", { exact: true }), "When");
  await choose(page, page.getByLabel("Description", { exact: true }), "What");
  await choose(page, page.getByLabel("Signed amount"), "Net");
  await choose(page, page.getByLabel("Date format"), "Month / day / year");
  await page.getByRole("button", { name: "Review transactions" }).click();
  await expect(
    page.getByText("1 valid · 1 need correction", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Include row 2")).toBeDisabled();
  await page.getByRole("button", { name: "Approve & import (1)" }).click();
  await expect(
    page.getByRole("heading", { name: "Import complete" }),
  ).toBeVisible();
});
