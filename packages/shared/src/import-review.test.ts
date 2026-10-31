import { expect, it } from "vitest";
import { updateImportRows } from "./import-review.js";
import { categorise } from "./categorisation.js";
import type { ImportRow } from "./types.js";

const row = (rowNumber: number, patch: Partial<ImportRow> = {}): ImportRow => ({
  rowNumber,
  description: "Local Shop",
  date: "2026-01-01",
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
it("remembers matching descriptions across pages without changing inclusion, dates or cents", () => {
  const rows = [
    row(1, { categoryId: "dining" }),
    row(22, { description: " LOCAL   SHOP ", include: false }),
    row(23, { kind: "refund", amountCents: 100 }),
    row(24, { kind: "income" }),
    row(25, { kind: "transfer" }),
    row(26, { error: "Bad source" }),
    row(27, { description: "Local Shop Online" }),
  ];
  const result = updateImportRows(rows, 1, { rememberCategory: true });
  expect(result.slice(1, 3)).toMatchObject([
    { categoryId: "dining", include: false, categorySource: "remembered" },
    {
      categoryId: "dining",
      kind: "refund",
      amountCents: 100,
      categorySource: "remembered",
    },
  ]);
  expect(result.slice(3)).toEqual(rows.slice(3));
  expect(
    result.map(({ date, amountCents }) => ({ date, amountCents })),
  ).toEqual(rows.map(({ date, amountCents }) => ({ date, amountCents })));
});
it("updates a remembered category and undoes propagation while preserving later individual edits", () => {
  let rows = [
    row(1, { categoryId: "dining" }),
    row(2, { categoryId: "groceries", categorySource: "rule" }),
    row(3),
  ];
  rows = updateImportRows(rows, 1, { rememberCategory: true });
  rows = updateImportRows(rows, 1, { categoryId: "health" });
  expect(rows.map((r) => r.categoryId)).toEqual(["health", "health", "health"]);
  rows = updateImportRows(rows, 3, { categoryId: "transport" });
  rows = updateImportRows(rows, 1, { rememberCategory: false });
  expect(rows.map((r) => r.categoryId)).toEqual([
    "health",
    "groceries",
    "transport",
  ]);
  expect(rows[1]?.categorySource).toBe("rule");
  expect(rows[2]?.categorySource).toBeUndefined();
});
it.each([
  { kind: "transfer" as const, categoryId: null },
  { description: "Different shop" },
  { include: false },
])("clears remembering after changing the source eligibility: %j", (patch) => {
  const remembered = updateImportRows(
    [row(1, { categoryId: "dining" }), row(2)],
    1,
    { rememberCategory: true },
  );
  const result = updateImportRows(remembered, 1, patch);
  expect(result[0]?.rememberCategory).toBe(false);
  expect(result[1]?.categoryId).toBeNull();
  expect(result[1]?.categorySource).toBeUndefined();
});
it("marks saved exact rules, gives them precedence and avoids substring matches", () => {
  const rows = [
    row(1, { description: "LOCAL   SHOP" }),
    row(2, { description: "Local Shop Online" }),
  ];
  categorise(
    rows,
    [
      {
        id: "dining",
        name: "Dining",
        kind: "expense",
        color: "#000000",
        archived: false,
      },
      {
        id: "groceries",
        name: "Groceries",
        kind: "expense",
        color: "#000000",
        archived: false,
      },
    ],
    [
      {
        id: "broad",
        pattern: "shop",
        categoryId: "groceries",
        priority: 0,
        enabled: true,
      },
      {
        id: "exact",
        pattern: "local shop",
        matchMode: "exact",
        categoryId: "dining",
        priority: 100,
        enabled: true,
      },
    ],
  );
  expect(rows.map((r) => r.categoryId)).toEqual(["dining", "groceries"]);
  expect(rows.map((r) => r.categorySource)).toEqual(["rule", "rule"]);
});

it("can remember from an automatically marked row without retaining the old source link", () => {
  let rows = updateImportRows(
    [row(1, { categoryId: "dining" }), row(2), row(3)],
    1,
    { rememberCategory: true },
  );
  rows = updateImportRows(rows, 2, { rememberCategory: true });
  expect(
    rows.filter((r) => r.rememberCategory).map((r) => r.rowNumber),
  ).toEqual([2]);
  rows = updateImportRows(rows, 1, { description: "Different shop" });
  expect(rows[1]).toMatchObject({
    rememberCategory: true,
    categoryId: "dining",
  });
  rows = updateImportRows(rows, 2, { rememberCategory: false });
  expect(rows[2]?.categoryId).toBeNull();
  expect(rows[0]?.description).toBe("Different shop");
});

it("keeps uncategorised description edits eligible for later AI suggestions", () => {
  const [result] = updateImportRows([row(1)], 1, {
    description: "Corrected merchant",
  });
  expect(result?.categoryId).toBeNull();
  expect(result?.categoryChosen).toBeUndefined();
});
