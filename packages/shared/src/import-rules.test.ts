import { expect, it } from "vitest";
import { refreshImportRules } from "./import-rules.js";
import { updateImportRows } from "./import-review.js";
import { mergeStatementDateRepairs } from "./statement-dates.js";
import { savedCategoryRuleChanges } from "./apply-category-rules.js";
import type {
  Account,
  Category,
  ImportRow,
  Rule,
  Transaction,
} from "./types.js";

const categories: Category[] = [
  {
    id: "dining",
    name: "Dining",
    kind: "expense",
    archived: false,
    color: "#000000",
  },
  {
    id: "food",
    name: "Groceries",
    kind: "expense",
    archived: false,
    color: "#000000",
  },
  {
    id: "salary",
    name: "Salary",
    kind: "income",
    archived: false,
    color: "#000000",
  },
  { id: "old", name: "Old", kind: "expense", archived: true, color: "#000000" },
];
const rules: Rule[] = [
  {
    id: "broad",
    pattern: "shop",
    matchMode: "contains",
    categoryId: "food",
    enabled: true,
    priority: 0,
  },
  {
    id: "exact",
    pattern: "Local shop",
    matchMode: "exact",
    categoryId: "dining",
    enabled: true,
    priority: 10,
  },
  {
    id: "salary",
    pattern: "shop",
    categoryId: "salary",
    enabled: true,
    priority: 0,
  },
  {
    id: "old",
    pattern: "Local shop",
    matchMode: "exact",
    categoryId: "old",
    enabled: true,
    priority: -1,
  },
];
const accounts: Account[] = ["bank", "other", "archived"].map((id) => ({
  id,
  name: id,
  type: "bank",
  archived: id === "archived",
  institution: "",
  owner: "household",
  openingDate: "2026-01-01",
  openingBalanceCents: 0,
}));
const data = { categories, rules, accounts };
const row = (patch: Partial<ImportRow> = {}): ImportRow => ({
  rowNumber: 1,
  date: "2026-10-01",
  description: "LOCAL  SHOP",
  amountCents: -100,
  categoryId: null,
  kind: "expense",
  counterAccountId: null,
  owner: "household",
  include: true,
  allowDuplicate: false,
  duplicate: false,
  error: null,
  ...patch,
});

it("refreshes all review pages with current rules, preserving source facts and explicit choices", () => {
  const input = [
    row(),
    row({ rowNumber: 23, include: false }),
    row({ categoryId: "food", categoryChosen: true }),
    row({ categoryChosen: true }),
    row({ categoryId: "food", rememberedFrom: 3 }),
    row({ error: "Invalid date" }),
    row({ kind: "transfer", counterAccountId: "other" }),
    row({ kind: "refund", amountCents: 100 }),
  ];
  const result = refreshImportRules(input, data, "bank");
  expect(result.map((r) => r.categoryId)).toEqual([
    "dining",
    "dining",
    "food",
    null,
    "food",
    null,
    null,
    "dining",
  ]);
  expect(result[1]?.include).toBe(false);
  expect(
    result.map(({ amountCents, date }) => ({ amountCents, date })),
  ).toEqual(input.map(({ amountCents, date }) => ({ amountCents, date })));
  expect(input[0]?.categoryId).toBeNull();
  const paused = refreshImportRules(
    result,
    { ...data, rules: rules.map((r) => ({ ...r, enabled: false })) },
    "bank",
  );
  expect(paused[0]?.categorySource).toBeUndefined();
});

it("rechecks repaired dates and changed types without overriding manual categories or transfer choices", () => {
  const original = [
    row({ date: "", error: "Missing year" }),
    row({
      rowNumber: 2,
      date: "",
      error: "Missing year",
      categoryId: "food",
      categoryChosen: true,
    }),
  ];
  const repaired = original.map((r) => ({
    ...r,
    date: "2026-10-01",
    error: null,
  }));
  expect(
    refreshImportRules(
      mergeStatementDateRepairs(original, repaired),
      data,
      "bank",
    ).map((r) => r.categoryId),
  ).toEqual(["dining", "food"]);
  let changed = refreshImportRules(
    [row({ kind: "income", amountCents: 100 })],
    data,
    "bank",
  );
  expect(changed[0]?.categoryId).toBe("salary");
  changed = updateImportRows(changed, 1, { kind: "refund", categoryId: null });
  expect(refreshImportRules(changed, data, "bank")[0]).toMatchObject({
    kind: "refund",
    categoryId: "dining",
  });
  const transfer: Rule = {
    id: "transfer",
    pattern: "shop",
    categoryId: null,
    kind: "transfer",
    accountId: "bank",
    counterAccountId: "other",
    direction: "out",
    enabled: true,
    priority: 0,
  };
  const withTransfer = { ...data, rules: [...rules, transfer] };
  const automatic = refreshImportRules([row()], withTransfer, "bank");
  expect(automatic[0]).toMatchObject({
    kind: "transfer",
    counterAccountId: "other",
  });
  const explicit = updateImportRows(automatic, 1, {
    kind: "expense",
    categoryId: null,
    counterAccountId: null,
  });
  expect(refreshImportRules(explicit, withTransfer, "bank")[0]).toMatchObject({
    kind: "expense",
    categoryId: "dining",
    counterAccountId: null,
  });
});

it("offers only uncategorised, active-account ledger matches using the same rule precedence", () => {
  const transaction = (
    id: string,
    patch: Partial<Transaction> = {},
  ): Transaction => ({
    id,
    accountId: "bank",
    version: 2,
    date: "2026-10-01",
    description: "Local shop",
    kind: "expense",
    amountCents: -100,
    categoryId: null,
    owner: "household",
    notes: "",
    transferGroupId: null,
    scheduleId: null,
    occurrenceDate: null,
    createdAt: "2026-11-08T00:00:00Z",
    ...patch,
  });
  expect(
    savedCategoryRuleChanges({
      ...data,
      transactions: [
        transaction("one"),
        transaction("two", { kind: "refund", amountCents: 100 }),
        transaction("income", { kind: "income", amountCents: 100 }),
        transaction("chosen", { categoryId: "food" }),
        transaction("transfer", { kind: "transfer" }),
        transaction("archived", { accountId: "archived" }),
        transaction("unmatched", { description: "Elsewhere" }),
      ],
    }),
  ).toEqual([
    { id: "one", version: 2, categoryId: "dining" },
    { id: "two", version: 2, categoryId: "dining" },
    { id: "income", version: 2, categoryId: "salary" },
  ]);
});
