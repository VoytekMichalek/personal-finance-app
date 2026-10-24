import { afterEach, expect, it, vi } from "vitest";
vi.mock("../integrations/credentials.js", () => ({
  getOpenRouterKey: async () => "synthetic-test-key",
}));
vi.mock("../../integrations/openrouter.js", () => ({
  approvedModels: { models: [{ id: "approved" }] },
}));
import { readWithAi } from "./ai-reader.js";
afterEach(() => vi.unstubAllGlobals());
function response(
  rows: unknown[],
  opening: unknown = null,
  closing: unknown = null,
) {
  return new Response(
    JSON.stringify({
      choices: [
        { message: { content: JSON.stringify({ rows, opening, closing }) } },
      ],
    }),
  );
}
it("accepts evidence-backed arbitrary layout extraction and rejects invented dates or amounts", async () => {
  const fetch = vi.fn().mockResolvedValue(
    response(
      [
        {
          sourceLine: 3,
          date: "2026-01-01",
          dateText: "01 Jan 2026",
          description: "Salary",
          amountCents: 300000,
          categoryId: "income",
        },
        {
          sourceLine: 4,
          date: "2026-01-02",
          dateText: "02 Jan 2026",
          description: "Made up amount",
          amountCents: -99900,
          categoryId: null,
        },
        {
          sourceLine: 5,
          date: "2026-01-30",
          dateText: "03 Jan 2026",
          description: "Changed date",
          amountCents: -2000,
          categoryId: null,
        },
      ],
      { sourceLine: 2, amountCents: 100000 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await readWithAi(
    [
      "Statement 2026\nOpening balance 1000.00\n01 Jan 2026 Salary 3000.00\n02 Jan 2026 Groceries 45.00\n03 Jan 2026 Netflix 20.00",
    ],
    "household",
    [
      {
        id: "income",
        name: "Salary",
        kind: "income",
        archived: false,
        color: "#ffffff",
      },
    ],
    "approved",
  );
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]?.amountCents).toBe(300000);
  expect(
    result.details.lines.filter((l) => l.status === "review"),
  ).toHaveLength(2);
  const payload = JSON.parse(fetch.mock.calls[0]![1].body);
  expect(payload.provider).toEqual({
    require_parameters: true,
    data_collection: "deny",
    zdr: true,
  });
});
it("processes later chunks without truncating a long statement", async () => {
  const lines = [
    "Statement 2026",
    ...Array.from({ length: 200 }, () => "Bank information"),
    "01 Jun 2026 Salary 3000.00",
  ];
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(
      response([
        {
          sourceLine: 202,
          date: "2026-06-01",
          dateText: "01 Jun 2026",
          description: "Salary",
          amountCents: 300000,
          categoryId: null,
        },
      ]),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await readWithAi(
    [lines.join("\n")],
    "household",
    [],
    "approved",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.rows).toHaveLength(1);
});
it("rejects malformed or unavailable model output without inventing records", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await expect(
    readWithAi(["Statement"], "household", [], "approved"),
  ).rejects.toThrow("incomplete statement");
});

it("validates card balances in ledger signs rather than unsigned amounts owed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response(
        [
          {
            sourceLine: 3,
            date: "2026-01-01",
            dateText: "01 Jan 2026",
            description: "Shop",
            amountCents: -1000,
            categoryId: null,
          },
        ],
        { sourceLine: 2, amountCents: -50000 },
        { sourceLine: 4, amountCents: -51000 },
      ),
    ),
  );
  const result = await readWithAi(
    [
      "2026\nOpening balance 500.00\n01 Jan 2026 Shop 10.00\nClosing balance 510.00",
    ],
    "household",
    [],
    "approved",
    undefined,
    "credit",
  );
  expect(result.details.opening?.amountCents).toBe(-50000);
  expect(result.details.closing?.amountCents).toBe(-51000);
  expect(result.details.warnings.some((w) => w.includes("reconcile"))).toBe(
    false,
  );
});
