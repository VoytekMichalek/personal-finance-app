import { test, expect, session, database } from "./fixtures";
import type { Transaction, ImportPreview } from "@finance/shared";

const headers = { Origin: "http://localhost:3000" };

test("detail deletion preserves a newly linked payment until both entries are explicitly confirmed", async ({
  page,
}) => {
  await session(page);
  const accounts = [];
  for (const name of ["Source account", "Receiving account"]) {
    const response = await page.request.post("/api/accounts", {
      headers,
      data: {
        name,
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000,
      },
    });
    expect(response.status()).toBe(201);
    accounts.push((await response.json()).id as string);
  }
  const created = await page.request.post("/api/transactions", {
    headers,
    data: {
      accountId: accounts[1],
      kind: "income",
      amountCents: 200,
      date: "2026-01-02",
      description: "Existing payment",
    },
  });
  expect(created.status()).toBe(201);
  const target = (await created.json()) as Transaction;
  await page.goto("/transactions?detail=" + target.id);
  const detail = page.getByRole("dialog", {
    name: "Existing payment",
    exact: true,
  });
  await expect(
    detail.getByRole("button", { name: "Edit transaction", exact: true }),
  ).toBeVisible();

  // Another session's real import changes the ledger after this detail snapshot
  // loaded. API completion, rather than a timer, establishes the race boundary.
  const response = await page.request.post("/api/imports/preview", {
    headers,
    data: {
      accountId: accounts[0],
      csv: "Date,Description,Amount\n2026-01-02,Linked source payment,-2.00",
      mapping: {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountColumn: "Amount",
        dateFormat: "ISO",
      },
    },
  });
  expect(response.ok()).toBe(true);
  const preview = (await response.json()) as ImportPreview;
  const linked = await page.request.post(`/api/imports/${preview.id}/commit`, {
    headers,
    data: {
      rows: [
        {
          ...preview.rows[0],
          kind: "transfer",
          counterAccountId: accounts[1],
          linkExisting: { id: target.id, version: target.version },
        },
      ],
    },
  });
  expect(linked.ok()).toBe(true);
  await expect(
    detail.getByRole("button", { name: "Edit transaction", exact: true }),
  ).toBeVisible();

  const rejected = page.waitForResponse(
    (result) =>
      result.url().endsWith("/transactions/bulk-delete") &&
      result.request().method() === "POST",
  );
  page.once("dialog", async (confirmation) => {
    expect(confirmation.message()).toBe("Delete this transaction?");
    await confirmation.accept();
  });
  await detail.getByRole("button", { name: "Delete", exact: true }).click();
  const stale = await rejected;
  expect(stale.status()).toBe(409);
  expect(stale.request().postDataJSON()).toEqual({
    records: [{ id: target.id, version: target.version }],
  });
  await expect(
    page.getByText(
      "A selected transaction or linked transfer changed. Refresh and review your selection again.",
      { exact: true },
    ),
  ).toBeVisible();
  const db = await database();
  try {
    const pair = await db.transaction.findMany();
    expect(pair).toHaveLength(2);
    expect(pair.every((row) => row.kind === "transfer")).toBe(true);
    expect(pair[0]!.transferGroupId).toBe(pair[1]!.transferGroupId);
    expect(pair.reduce((sum, row) => sum + row.amountCents, 0n)).toBe(0n);

    await page.goto("/transactions?detail=" + target.id);
    await expect(detail).toBeVisible();
    await expect(
      detail.getByRole("button", { name: "Edit transaction", exact: true }),
    ).toBeHidden();
    const deleted = page.waitForResponse(
      (result) =>
        result.url().endsWith("/transactions/bulk-delete") &&
        result.request().method() === "POST",
    );
    page.once("dialog", async (confirmation) => {
      expect(confirmation.message()).toBe(
        "Delete both sides of this transfer?",
      );
      await confirmation.accept();
    });
    await detail.getByRole("button", { name: "Delete", exact: true }).click();
    const result = await deleted;
    expect(result.ok()).toBe(true);
    const submitted = result.request().postDataJSON() as {
      records: { id: string; version: number }[];
    };
    expect(submitted.records).toHaveLength(2);
    expect(submitted.records).toEqual(
      expect.arrayContaining(pair.map(({ id, version }) => ({ id, version }))),
    );
    await expect(detail).toBeHidden();
    expect(await db.transaction.count()).toBe(0);
  } finally {
    await db.$disconnect();
  }
});
