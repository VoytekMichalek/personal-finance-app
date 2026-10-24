import { test, expect, session, choose } from "./fixtures";
import {
  statementPdf,
  sixMonthStatement,
} from "../apps/api/src/integration/statement-fixture";
const headers = { Origin: "http://localhost:3000" };
test("readable review defaults to account owner, creates categories and preserves edited rows", async ({
  page,
}, info) => {
  const owner = await session(page);
  const response = await page.request.post("/api/accounts", {
    headers,
    data: {
      name: "Personal card",
      owner,
      type: "credit",
      openingDate: "2026-01-07",
      openingBalanceCents: 0,
    },
  });
  const account = await response.json();
  const pdf = statementPdf([
    "Statement period 07/01/2026 to 06/02/2026\nPrevious balance 500.00\nDate Details Amount\n05/01/2026 AAMI INSURANCE MONTHLY PREMIUM POLICY COVER FOR VEHICLE 25.00\nNew balance 525.00".split(
      "\n",
    ),
  ]);
  const upload = await page.request.post("/api/statements", {
    headers,
    multipart: {
      accountId: account.id,
      file: { name: "card.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  const saved = await upload.json();
  await page.goto(`/accounts/${account.id}/statement/${saved.id}`);
  await expect(page.getByLabel("Statement opening balance (AUD)")).toHaveValue(
    "-500.00",
  );
  await expect(
    page.getByRole("button", { name: "Statement opening date" }),
  ).toContainText("5 Jan 2026");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Owner row 1", { exact: true })).toContainText(
    "Voytek",
  );
  const description = page.getByLabel("Description row 1", { exact: true });
  await expect(description).toHaveValue(/POLICY COVER/);
  expect(
    await description.evaluate(
      (el) =>
        el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
    ),
  ).toBe(true);
  await choose(
    page,
    page.getByLabel("Category row 1", { exact: true }),
    "+ Create category",
  );
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Car insurance");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByLabel("Category row 1", { exact: true }),
  ).toContainText("Car insurance");
  await description.fill("Edited readable description");
  await expect(description).toHaveValue("Edited readable description");
  await choose(
    page,
    page.getByLabel("Owner row 1", { exact: true }),
    "Household",
  );
  await expect(description).toHaveValue("Edited readable description");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/review-readable-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "4. Confirm", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept & import statement" }).click();
  await expect(
    page.getByRole("heading", { name: "Statement imported" }),
  ).toBeVisible();
});
test("expenses filter refunds and ownership", async ({ page }, info) => {
  const owner = await session(page);
  const account = await (
    await page.request.post("/api/accounts", {
      headers,
      data: {
        name: "Everyday",
        owner,
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000,
      },
    })
  ).json();
  for (const [kind, amountCents, person] of [
    ["expense", 10000, owner],
    ["refund", 2500, owner],
    ["expense", 5000, "household"],
  ] as const) {
    const response = await page.request.post("/api/transactions", {
      headers,
      data: {
        accountId: account.id,
        kind,
        amountCents,
        owner: person,
        date: "2026-01-05",
        description: kind,
        categoryId: null,
      },
    });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/expenses");
  await page.getByRole("button", { name: "All history" }).click();
  await expect(
    page.getByText("$125.00", { exact: true }).first(),
  ).toBeVisible();
  await choose(
    page,
    page.getByRole("combobox", { name: "Person", exact: true }),
    "Voytek",
  );
  await expect(page.getByText("$75.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  await expect(
    page.getByText("Everyday", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/expenses-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Categories & rules" }),
  ).toHaveCount(0);
  await page.goto("/categories");
  await expect(
    page.getByRole("heading", { name: "Categories", exact: true }),
  ).toBeVisible();
});
test("six month review edits stay responsive across pagination", async ({
  page,
}) => {
  await session(page);
  const account = await (
    await page.request.post("/api/accounts", {
      headers,
      data: {
        name: "Savings",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0,
      },
    })
  ).json();
  const source = [...sixMonthStatement(), ...sixMonthStatement()];
  const uploaded = await (
    await page.request.post("/api/statements", {
      headers,
      multipart: {
        accountId: account.id,
        file: {
          name: "six-months.pdf",
          mimeType: "application/pdf",
          buffer: statementPdf(source),
        },
      },
    })
  ).json();
  await page.goto(`/accounts/${account.id}/statement/${uploaded.id}`);
  await page
    .getByRole("button", { name: "2. Review transactions", exact: true })
    .click();
  await page
    .getByLabel("Description row 1", { exact: true })
    .fill("Salary edited");
  await choose(
    page,
    page.getByLabel("Category row 2", { exact: true }),
    "Groceries",
  );
  await expect(
    page.getByLabel("Description row 1", { exact: true }),
  ).toHaveValue("Salary edited");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByLabel("Description row 21", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByLabel("Description row 1", { exact: true }),
  ).toHaveValue("Salary edited");
  await expect(
    page.getByLabel("Category row 2", { exact: true }),
  ).toContainText("Groceries");
});

for (const kind of ["asset", "liability"] as const)
  test(`${kind} opens its own page and saves valuation history`, async ({
    page,
  }, info) => {
    const owner = await session(page);
    const asset = await (
      await page.request.post("/api/assets", {
        headers,
        data: {
          name: kind === "asset" ? "Our home" : "Home loan",
          kind,
          classification: kind === "asset" ? "property" : "loan",
          owner,
        },
      })
    ).json();
    for (const [date, amountCents] of [
      ["2026-01-01", 50000000],
      ["2026-06-01", 55000000],
    ] as const)
      expect(
        (
          await page.request.put(`/api/assets/${asset.id}/valuations`, {
            headers,
            data: { date, amountCents },
          })
        ).ok(),
      ).toBe(true);
    await page.goto("/assets");
    await page.getByRole("link", { name: new RegExp(asset.name) }).click();
    await expect(
      page.getByRole("heading", { name: asset.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: asset.name + " value history" }),
    ).toBeVisible();
    await expect(
      page.getByText("$550,000.00", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit valuation 2026-06-01" })
      .click();
    await page.getByLabel("Value (AUD)").fill("540000");
    await page.getByRole("button", { name: "Save valuation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.reload();
    await expect(
      page.getByText("$540,000.00", { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/${kind}-detail-${info.project.name}.png`,
      fullPage: true,
    });
  });

test("an imported statement can add remaining recurring suggestions without duplicate transactions", async ({
  page,
}) => {
  await session(page);
  const account = await (
    await page.request.post("/api/accounts", {
      headers,
      data: {
        name: "Everyday",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 0,
      },
    })
  ).json();
  const upload = await (
    await page.request.post("/api/statements", {
      headers,
      multipart: {
        accountId: account.id,
        file: {
          name: "six-months.pdf",
          mimeType: "application/pdf",
          buffer: statementPdf(sixMonthStatement()),
        },
      },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/statements/" + upload.id)).json())
          .status,
    )
    .toBe("ready");
  const preview = await (
    await page.request.get("/api/statements/" + upload.id)
  ).json();
  expect(
    (
      await page.request.post(`/api/statements/${preview.id}/commit`, {
        headers,
        data: {
          rows: preview.rows,
          opening: preview.details.opening,
          applyOpening: true,
          reviewed: true,
          schedules: [],
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/accounts/${account.id}/statement/${preview.id}`);
  await expect(
    page.getByRole("heading", { name: "Recurring items from this statement" }),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Accept recurring items", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Recurring items saved.",
  );
  const snapshot = await (await page.request.get("/api/snapshot")).json();
  expect(snapshot.transactions).toHaveLength(12);
  expect(snapshot.schedules).toHaveLength(1);
});
