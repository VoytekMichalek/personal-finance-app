import { expect, it } from "vitest";
import {
  importReconciliations,
  sameReconciliation,
} from "./import-reconciliations.js";
import type { ImportRow, Transaction } from "./types.js";
const row: ImportRow = {
  rowNumber: 1,
  date: "2026-10-01",
  amountCents: 2500,
  description: "Nicola statement narrative",
  kind: "income",
  counterAccountId: null,
  owner: "household",
  categoryId: null,
  include: false,
  duplicate: true,
  allowDuplicate: false,
  error: null,
};
const incoming: Transaction = {
  id: "in",
  accountId: "nicola",
  date: row.date,
  amountCents: 2500,
  description: "Voytek transfer",
  kind: "transfer",
  transferGroupId: "pair",
  version: 1,
  categoryId: null,
  owner: "household",
  notes: "preserve",
  scheduleId: null,
  occurrenceDate: null,
  createdAt: "",
  importBatchId: null,
  sourceRow: null,
};
const outgoing: Transaction = {
  ...incoming,
  id: "out",
  accountId: "voytek",
  amountCents: -2500,
  importBatchId: "original",
  sourceRow: 2,
};
it("matches the previously generated transfer side despite different bank descriptions and default exclusion", () => {
  const matches = importReconciliations("nicola", [row], [incoming, outgoing]);
  expect(matches).toHaveLength(1);
  expect(matches[0]!.choice).toEqual({
    id: "in",
    version: 1,
    counterpartId: "out",
    counterpartVersion: 1,
  });
  expect(
    sameReconciliation(matches[0]!.choice, {
      ...matches[0]!.choice,
      counterpartVersion: 2,
    }),
  ).toBe(false);
});
it("leaves repeated source amounts, ambiguous payments, incomplete pairs and already imported entries for individual review", () => {
  expect(
    importReconciliations(
      "nicola",
      [row, { ...row, rowNumber: 2 }],
      [incoming, outgoing],
    ),
  ).toEqual([]);
  expect(
    importReconciliations(
      "nicola",
      [row],
      [incoming, outgoing, { ...incoming, id: "unrelated" }],
    ),
  ).toEqual([]);
  for (const pair of [
    [incoming],
    [incoming, { ...outgoing, amountCents: -2501 }],
    [incoming, { ...outgoing, accountId: "nicola" }],
    [{ ...incoming, importBatchId: "previous" }, outgoing],
  ])
    expect(importReconciliations("nicola", [row], pair)).toEqual([]);
  expect(
    importReconciliations(
      "nicola",
      [{ ...row, counterAccountId: "wrong" }],
      [incoming, outgoing],
    ),
  ).toEqual([]);
});
