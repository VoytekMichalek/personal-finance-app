import { expect, it } from "vitest";
import { categorise } from "./categorisation.js";
import type { Category, ImportRow, Rule } from "./types.js";

const categories: Category[] = [
  {
    id: "groceries",
    name: "Groceries",
    kind: "expense",
    color: "#000000",
    archived: false,
  },
  {
    id: "dining",
    name: "Dining",
    kind: "expense",
    color: "#000000",
    archived: false,
  },
  {
    id: "salary",
    name: "Salary",
    kind: "income",
    color: "#000000",
    archived: false,
  },
  {
    id: "retired",
    name: "Subscriptions",
    kind: "expense",
    color: "#000000",
    archived: true,
  },
];
const row = (
  description: string,
  patch: Partial<ImportRow> = {},
): ImportRow => ({
  rowNumber: 1,
  date: "2026-09-30",
  description,
  amountCents: -100,
  kind: "expense",
  categoryId: null,
  counterAccountId: null,
  owner: "household",
  include: true,
  allowDuplicate: false,
  duplicate: false,
  error: null,
  ...patch,
});

it("suggests familiar merchants and past categories without requiring AI", () => {
  const rows = [
    row("Coles Brisbane"),
    row("Local restaurant"),
    row("Salary payment", { kind: "income", amountCents: 50000 }),
    row("Neighbourhood shop"),
  ];
  categorise(
    rows,
    categories,
    [],
    [{ description: "NEIGHBOURHOOD SHOP", categoryId: "groceries" }],
  );
  expect(rows.map((r) => r.categoryId)).toEqual([
    "groceries",
    "dining",
    "salary",
    "groceries",
  ]);
});

it("uses enabled rules in priority order before history and merchant hints", () => {
  const rows = [row("  Coles   Brisbane receipt ")];
  const rules: Rule[] = [
    {
      id: "disabled",
      pattern: "coles",
      categoryId: "salary",
      priority: 0,
      enabled: false,
    },
    {
      id: "broad",
      pattern: "coles",
      categoryId: "groceries",
      priority: 20,
      enabled: true,
    },
    {
      id: "chosen",
      pattern: "coles brisbane",
      categoryId: "dining",
      priority: 10,
      enabled: true,
    },
  ];
  categorise(rows, categories, rules, [
    { description: "Coles Brisbane", categoryId: "groceries" },
  ]);
  expect(rows[0]?.categoryId).toBe("dining");
});

it("never assigns archived or wrong-kind categories and skips invalid rows and transfers", () => {
  const rows = [
    row("Netflix"),
    row("Coles", { kind: "income", amountCents: 100 }),
    row("Coles refund", { kind: "refund", amountCents: 100 }),
    row("Coles", { kind: "transfer" }),
    row("Coles", { error: "Invalid date" }),
  ];
  categorise(
    rows,
    categories,
    [],
    [{ description: "Netflix", categoryId: "retired" }],
  );
  expect(rows.map((r) => r.categoryId)).toEqual([
    null,
    null,
    "groceries",
    null,
    null,
  ]);
});
