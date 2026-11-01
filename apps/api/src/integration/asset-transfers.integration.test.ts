import "./fixtures.js";
import { expect, it } from "vitest";
import fs from "node:fs";
import { prisma } from "../lib/db.js";
import { account, agent, post, put } from "./fixtures.js";
import {
  assetValue,
  netWorth,
  overview,
  transactionFiltersSchema,
  type Snapshot,
} from "@finance/shared";

async function setup(kind: "asset" | "liability" = "asset") {
  const bank = await account();
  await prisma.account.update({
    where: { id: bank },
    data: { openingDate: "2026-01-01" },
  });
  const created = await post("/assets", {
    name: kind === "asset" ? "Shares" : "Loan",
    kind,
    classification: kind === "asset" ? "investment" : "loan",
    owner: "household",
  });
  expect(created.status, created.body.error).toBe(200);
  const asset = created.body;
  expect(
    (
      await put(`/assets/${asset.id}/valuations`, {
        date: "2026-10-01",
        amountCents: 50000,
      })
    ).status,
  ).toBe(200);
  const data = (await agent()).body as Snapshot;
  const ledger = data.assets.find((item) => item.id === asset.id)!.accountId!;
  expect(data.accounts.find((item) => item.id === ledger)).toMatchObject({
    assetId: asset.id,
    type: kind,
    openingBalanceCents: 0,
  });
  return { bank, asset, ledger, before: netWorth(data, "2026-10-02") };
}

it.each(["asset", "liability"] as const)(
  "records balanced transfers to a %s and updates its value once",
  async (kind) => {
    const { bank, asset, ledger, before } = await setup(kind);
    const transferred = await post("/transfers", {
      fromAccountId: bank,
      toAccountId: ledger,
      date: "2026-10-02",
      amountCents: 10000,
    });
    expect(transferred.status, transferred.body.error).toBe(201);
    const data = (await agent()).body as Snapshot;
    expect(data.transactions).toHaveLength(2);
    expect(
      data.transactions.reduce((sum, row) => sum + row.amountCents, 0),
    ).toBe(0);
    expect(
      assetValue(
        data.assets.find((item) => item.id === asset.id)!,
        "2026-10-02",
        data.transactions,
      ),
    ).toBe(kind === "asset" ? 60000 : -40000);
    expect(netWorth(data, "2026-10-02")).toBe(before);
    expect(overview({ ...data, today: "2026-10-02" })).toMatchObject({
      income: 0,
      spent: 0,
      balance: 90000,
    });
    expect(
      (
        await put(`/assets/${asset.id}/valuations`, {
          date: "2026-10-02",
          amountCents: 70000,
        })
      ).status,
    ).toBe(200);
    const valued = (await agent()).body as Snapshot;
    expect(
      assetValue(valued.assets[0]!, "2026-10-02", valued.transactions),
    ).toBe(kind === "asset" ? 70000 : -70000);
  },
);

it("converts old expenses to asset transfers, remembers matches and applies that destination to future CSV imports", async () => {
  const { bank, ledger } = await setup();
  const rows = [];
  for (const date of ["2026-10-02", "2026-10-03"]) {
    const row = await post("/transactions", {
      accountId: bank,
      date,
      description: "Broker contribution",
      kind: "expense",
      amountCents: 1000,
    });
    expect(row.status).toBe(201);
    rows.push(row.body);
  }
  expect(
    (
      await put(`/transactions/${rows[0].id}/type`, {
        version: 1,
        kind: "transfer",
        counterAccountId: ledger,
        createCounterpart: true,
      })
    ).status,
  ).toBe(200);
  const data = (await agent()).body as Snapshot;
  const source = data.transactions.find((row) => row.id === rows[0].id)!;
  const peer = data.transactions.find((row) => row.accountId === ledger)!;
  const remembered = await post("/transactions/remember", {
    source: { id: source.id, version: source.version },
    categoryId: null,
    pattern: "Broker contribution",
    matchMode: "exact",
    filters: transactionFiltersSchema.parse({ accountId: bank }),
    records: data.transactions
      .filter((row) => row.accountId === bank)
      .map(({ id, version }) => ({ id, version })),
    transferChoices: [
      { id: source.id, counterpart: { id: peer.id, version: peer.version } },
      { id: rows[1].id, createCounterpart: true },
    ],
  });
  expect(remembered.status, remembered.body.error).toBe(200);
  const preview = await post("/imports/preview", {
    accountId: bank,
    csv: "Date,Description,Amount\n2026-10-04,Broker contribution,-10.00",
    hasHeaders: true,
    mapping: {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountColumn: "Amount",
      dateFormat: "ISO",
    },
  });
  expect(preview.status, preview.body.error).toBe(200);
  expect(preview.body.rows[0]).toMatchObject({
    kind: "transfer",
    counterAccountId: ledger,
  });
  expect(
    (
      await post(`/imports/${preview.body.id}/commit`, {
        rows: preview.body.rows,
      })
    ).status,
  ).toBe(200);
  const after = (await agent()).body as Snapshot;
  expect(after.transactions).toHaveLength(6);
  expect(
    after.transactions.every(
      (row) => row.kind === "transfer" && row.categoryId === null,
    ),
  ).toBe(true);
  expect(assetValue(after.assets[0]!, "2026-10-04", after.transactions)).toBe(
    53000,
  );
});

it("preserves the associated account on rename and rejects changing its historical type or opening balance", async () => {
  const { bank, asset, ledger } = await setup();
  expect(
    (
      await put(`/assets/${asset.id}`, {
        name: "Share portfolio",
        kind: "asset",
        classification: "investment",
        owner: "household",
      })
    ).status,
  ).toBe(200);
  expect(
    (await prisma.account.findUniqueOrThrow({ where: { id: ledger } })).name,
  ).toBe("Share portfolio");
  await post("/transfers", {
    fromAccountId: bank,
    toAccountId: ledger,
    date: "2026-10-02",
    amountCents: 1000,
  });
  expect(
    (
      await put(`/assets/${asset.id}`, {
        name: "Changed",
        kind: "liability",
        owner: "household",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await put(`/accounts/${ledger}`, {
        name: "Changed",
        type: "bank",
        openingDate: "2026-01-01",
        openingBalanceCents: 100000,
      })
    ).status,
  ).toBe(400);
  expect(
    (await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })).kind,
  ).toBe("asset");
});

it("the additive migration creates movement accounts for existing assets without changing valuations", async () => {
  const migration = fs.readFileSync(
    new URL(
      "../../prisma/migrations/20261101120000_asset_transaction_accounts/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Temporary tables shadow the isolated test tables and disappear on commit.
  // Execute the actual migration against the prior shape, including real values.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'CREATE TEMP TABLE "Asset" ("id" TEXT PRIMARY KEY, "name" TEXT, "kind" TEXT, "owner" TEXT, "archived" BOOLEAN) ON COMMIT DROP',
    );
    await tx.$executeRawUnsafe(
      'CREATE TEMP TABLE "Account" ("id" TEXT PRIMARY KEY, "name" TEXT, "type" TEXT, "institution" TEXT, "owner" TEXT, "openingDate" TEXT, "openingBalanceCents" BIGINT, "archived" BOOLEAN) ON COMMIT DROP',
    );
    await tx.$executeRawUnsafe(
      'CREATE TEMP TABLE "Valuation" ("assetId" TEXT, "amountCents" BIGINT) ON COMMIT DROP',
    );
    await tx.$executeRawUnsafe(
      "INSERT INTO \"Asset\" VALUES ('old-shares', 'Shares', 'asset', 'household', false), ('old-loan', 'Loan', 'liability', 'household', false)",
    );
    await tx.$executeRawUnsafe(
      "INSERT INTO \"Valuation\" VALUES ('old-shares', 12345), ('old-loan', 99999)",
    );
    for (const sql of migration
      .split(";")
      .filter((statement) => statement.trim()))
      await tx.$executeRawUnsafe(sql);
    const rows = await tx.$queryRawUnsafe<
      { assetId: string; type: string; openingBalanceCents: bigint }[]
    >(
      'SELECT "assetId", "type", "openingBalanceCents" FROM "Account" ORDER BY "assetId"',
    );
    expect(rows).toEqual([
      { assetId: "old-loan", type: "liability", openingBalanceCents: 0n },
      { assetId: "old-shares", type: "asset", openingBalanceCents: 0n },
    ]);
    expect(
      await tx.$queryRawUnsafe(
        'SELECT "amountCents" FROM "Valuation" ORDER BY "amountCents"',
      ),
    ).toEqual([{ amountCents: 12345n }, { amountCents: 99999n }]);
  });
});
