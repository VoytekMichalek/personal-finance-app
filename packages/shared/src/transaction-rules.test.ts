import { expect, it } from "vitest";
import { updateImportRows } from "./import-review.js";
import { applyTransferRules } from "./categorisation.js";
import {
  filterTransactions,
  matchingTransferTransactions,
  transactionFiltersSchema,
  transferCounterpart,
  transferChoicesFor,
} from "./transaction-rules.js";
import type { ImportRow, Rule, Transaction } from "./types.js";
const row = (patch: Partial<Transaction> = {}) =>
  ({
    id: "source",
    accountId: "bank",
    description: "Rent payment",
    date: "2026-10-01",
    amountCents: -1000,
    kind: "expense",
    categoryId: null,
    owner: "household",
    version: 1,
    transferGroupId: null,
    scheduleId: null,
    occurrenceDate: null,
    notes: "",
    createdAt: "",
    ...patch,
  }) as Transaction;
it("intersects ledger filters and includes refunds under expenses without changing search semantics", () => {
  const base = row();
  const filters = {
    ...transactionFiltersSchema.parse({}),
    accountId: "bank",
    categoryId: "none",
    owner: "household",
    kind: "expense" as const,
    search: "RENT",
    from: base.date,
    to: base.date,
  };
  const records = [
    base,
    row({ id: "refund", kind: "refund", amountCents: 500 }),
    ...[
      { accountId: "other" },
      { owner: "person" },
      { categoryId: "category" },
      { kind: "income" as const },
      { date: "2026-09-30" },
      { date: "2026-10-02" },
      { description: "Shop" },
    ].map((patch, i) => row({ id: "excluded" + i, ...patch })),
  ];
  expect(filterTransactions(records, filters).map((r) => r.id)).toEqual([
    "source",
    "refund",
  ]);
});
it("matches only the source account and direction and validates linked pairs and candidates", () => {
  const source = row({ kind: "transfer", transferGroupId: "pair" });
  const peer = row({
    id: "peer",
    kind: "transfer",
    accountId: "savings",
    amountCents: 1000,
    transferGroupId: "pair",
  });
  const other = row({ id: "other" });
  const candidate = row({
    id: "candidate",
    accountId: "savings",
    amountCents: 1000,
    kind: "income",
  });
  const all = [source, peer, other, candidate];
  expect(
    matchingTransferTransactions(all, source, {
      pattern: "rent",
      matchMode: "contains",
    }).map((r) => r.id),
  ).toEqual(["source", "other"]);
  expect(transferCounterpart(source, all)).toBe(peer);
  expect(
    transferCounterpart(source, [
      ...all,
      row({ id: "third", transferGroupId: "pair" }),
    ]),
  ).toBeUndefined();
  expect(transferChoicesFor(other, all, "savings").candidates).toEqual([
    candidate,
  ]);
  expect(transferChoicesFor(source, all, "different").issue).toContain(
    "different or incomplete",
  );
  expect(
    transferChoicesFor(row({ occurrenceDate: source.date }), all, "savings")
      .issue,
  ).toContain("scheduled");
});
it("future transfer suggestions respect account, direction, enabled state and counterpart opening dates", () => {
  const rule: Rule = {
    id: "rule",
    kind: "transfer",
    categoryId: null,
    accountId: "bank",
    counterAccountId: "savings",
    direction: "out",
    pattern: "rent",
    matchMode: "contains",
    priority: 0,
    enabled: true,
  };
  const preview = (patch: Partial<ImportRow> = {}) =>
    ({
      ...row(),
      rowNumber: 1,
      include: true,
      allowDuplicate: false,
      duplicate: false,
      counterAccountId: null,
      error: null,
      ...patch,
    }) as ImportRow;
  const accounts = [
    { id: "savings", archived: false, openingDate: "2026-10-01" },
  ];
  const rows = [
    preview(),
    preview({ amountCents: 1000, kind: "income" }),
    preview({ date: "2026-09-30" }),
    preview({ description: "Other payment" }),
    preview({ error: "Invalid" }),
  ];
  applyTransferRules(rows, [rule], "bank", accounts);
  expect(rows[0]).toMatchObject({
    kind: "transfer",
    categoryId: null,
    counterAccountId: "savings",
    categorySource: "rule",
  });
  expect(
    updateImportRows(rows, 1, { counterAccountId: "different" })[0]
      ?.categorySource,
  ).toBeUndefined();
  expect(rows.slice(1).every((r) => r.counterAccountId === null)).toBe(true);
  for (const [rules, accountId, targets] of [
    [[{ ...rule, enabled: false }], "bank", accounts],
    [[rule], "other", accounts],
    [[rule], "bank", [{ ...accounts[0]!, archived: true }]],
  ] as const) {
    const untouched = preview();
    applyTransferRules([untouched], [...rules], accountId, [...targets]);
    expect(untouched.kind).toBe("expense");
  }
});
