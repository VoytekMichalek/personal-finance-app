import { expect, it } from "vitest";
import { importBalance } from "./import-balance";
import type { ImportPreview, Snapshot } from "@finance/shared";
it("compares selected rows with the bank at the file closing date, retaining earlier history", () => {
  const data = {
    today: "2026-10-28",
    accounts: [
      { id: "a", openingDate: "2026-01-01", openingBalanceCents: 100000 },
    ],
    transactions: [
      { accountId: "a", date: "2026-02-01", amountCents: -50000 },
      { accountId: "a", date: "2026-04-01", amountCents: 90000 },
      { accountId: "b", date: "2026-03-01", amountCents: 500000 },
    ],
  } as Snapshot;
  const preview = {
    reconciliation: {
      to: "2026-03-16",
      bankClosingCents: 50500,
      balanceVerified: true,
    },
    rows: [
      {
        rowNumber: 1,
        date: "2026-03-14",
        amountCents: -1000,
        include: true,
        error: null,
      },
      {
        rowNumber: 2,
        date: "2026-03-15",
        amountCents: -500,
        include: true,
        error: null,
      },
      {
        rowNumber: 3,
        date: "2026-03-16",
        amountCents: 2000,
        include: true,
        error: null,
      },
    ],
  } as ImportPreview;
  expect(importBalance(data, "a", preview)).toMatchObject({
    projected: 50500,
    difference: 0,
  });
  preview.rows[0]!.include = false;
  expect(importBalance(data, "a", preview)).toMatchObject({
    projected: 51500,
    difference: 1000,
  });
  preview.reconciliation!.balanceVerified = false;
  expect(importBalance(data, "a", preview).difference).toBeNull();
});
