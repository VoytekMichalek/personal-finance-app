import "./fixtures.js";
import { expect, it, vi } from "vitest";
vi.mock("../integrations/openrouter.js", async (original) => ({
  ...(await original<typeof import("../integrations/openrouter.js")>()),
  suggest: vi.fn(),
}));
import { suggest } from "../integrations/openrouter.js";
import { prisma } from "../lib/db.js";
import { post } from "./fixtures.js";
const input = {
  csv: "Date,Description,Amount\n01/01/2026,Example,-1",
  rows: [
    {
      rowNumber: 1,
      description: "Example",
      amountCents: -100,
      kind: "expense",
    },
  ],
};
it("requires complete, unique, eligible AI suggestions and keeps requests bounded", async () => {
  await prisma.setup.update({
    where: { id: 1 },
    data: { modelId: "synthetic" },
  });
  const income = await prisma.category.findFirstOrThrow({
    where: { kind: "income" },
  });
  const expense = await prisma.category.findFirstOrThrow({
    where: { kind: "expense" },
  });
  for (const categories of [
    [],
    [{ rowNumber: 2, categoryId: null }],
    [
      { rowNumber: 1, categoryId: null },
      { rowNumber: 1, categoryId: null },
    ],
  ]) {
    vi.mocked(suggest).mockResolvedValue({ categories });
    expect((await post("/imports/suggest", input)).status).toBe(502);
  }
  for (const categoryId of [
    income.id,
    "Groceries",
    "00000000-0000-4000-8000-000000000000",
  ]) {
    vi.mocked(suggest).mockResolvedValue({
      categories: [{ rowNumber: 1, categoryId }],
    });
    const response = await post("/imports/suggest", input);
    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual([
      { rowNumber: 1, categoryId: null },
    ]);
  }
  vi.mocked(suggest).mockResolvedValue({
    categories: [{ rowNumber: 1, categoryId: expense.id }],
  });
  expect((await post("/imports/suggest", input)).body.categories).toEqual([
    { rowNumber: 1, categoryId: expense.id },
  ]);
  expect(vi.mocked(suggest).mock.calls.at(-1)?.[2]).toBe("categories");
  expect(vi.mocked(suggest).mock.calls.at(-1)?.[3]).toContain(expense.id);
  vi.mocked(suggest).mockResolvedValue({
    categories: [{ rowNumber: 1, categoryId: null }],
  });
  expect((await post("/imports/suggest", input)).status).toBe(200);
  expect(
    (
      await post("/imports/suggest", {
        ...input,
        rows: Array.from({ length: 26 }, (_, index) => ({
          ...input.rows[0],
          rowNumber: index + 1,
        })),
      })
    ).status,
  ).toBe(400);
  expect(await prisma.transaction.count()).toBe(0);
});

it("preserves valid suggestions when another row has an unknown or archived category", async () => {
  await prisma.setup.update({
    where: { id: 1 },
    data: { modelId: "synthetic" },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { name: "Groceries" },
  });
  const archived = await prisma.category.create({
    data: {
      name: "Synthetic archived AI category",
      kind: "expense",
      color: "#765432",
      archived: true,
    },
  });
  try {
    vi.mocked(suggest).mockResolvedValue({
      categories: [
        { rowNumber: 1, categoryId: category.id },
        { rowNumber: 2, categoryId: "a made-up category" },
        { rowNumber: 3, categoryId: archived.id },
      ],
    });
    const response = await post("/imports/suggest", {
      ...input,
      rows: [1, 2, 3].map((rowNumber) => ({ ...input.rows[0], rowNumber })),
    });
    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual([
      { rowNumber: 1, categoryId: category.id },
      { rowNumber: 2, categoryId: null },
      { rowNumber: 3, categoryId: null },
    ]);
    expect(await prisma.transaction.count()).toBe(0);
  } finally {
    await prisma.category.delete({ where: { id: archived.id } });
  }
});

it("limits AI calls separately so a large review cannot block approval", async () => {
  await prisma.setup.update({
    where: { id: 1 },
    data: { modelId: "synthetic" },
  });
  vi.mocked(suggest).mockResolvedValue({
    categories: [{ rowNumber: 1, categoryId: null }],
  });
  // Real request counting within the fixed window; no timer sleeps or synthetic clock.
  for (let index = 0; index < 30; index++)
    expect((await post("/imports/suggest", input)).status).toBe(200);
  const limited = await post("/imports/suggest", input);
  expect(limited.status).toBe(429);
  expect(limited.headers["retry-after"]).toBeDefined();
  const created = await post("/accounts", {
    name: "Rate limit fixture",
    type: "bank",
    owner: "household",
    openingDate: "2026-01-01",
    openingBalanceCents: 100000,
  });
  const headers = await post("/imports/headers", {
    csv: input.csv,
    accountId: created.body.id,
  });
  expect(headers.status).toBe(200);
  const preview = await post("/imports/preview", {
    csv: input.csv,
    accountId: created.body.id,
    mapping: headers.body.mapping,
  });
  expect(preview.status).toBe(200);
  const committed = await post(`/imports/${preview.body.id}/commit`, {
    rows: preview.body.rows,
  });
  expect(committed.status).toBe(200);
  expect(committed.body.imported).toBe(1);
});
