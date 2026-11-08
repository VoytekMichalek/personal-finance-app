import { afterEach, expect, it, vi } from "vitest";
vi.mock("../integrations/credentials.js", () => ({
  getOpenRouterKey: async () => "synthetic-test-key",
}));
vi.mock("../../integrations/openrouter.js", () => ({
  approvedModels: { models: [{ id: "approved" }] },
}));
import { readWithAi } from "./ai-reader.js";
import { qantasStatement } from "../../integration/qantas-fixture.js";
afterEach(() => vi.unstubAllGlobals());

it("stops a recognised foreign-only wallet before sending it to AI", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const pages = qantasStatement().map((page) =>
    page.join("\n").replaceAll("AUD", "USD"),
  );
  await expect(readWithAi(pages, "household", [], "approved")).rejects.toThrow(
    "Export the AUD wallet",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps Qantas rows, AUD settlements, refund/transfer types and orphan warnings authoritative when AI changes or omits evidence", async () => {
  const pages = qantasStatement(true).map((page) => page.join("\n"));
  const lines = pages
    .flatMap((page) => page.split("\n"))
    .filter((line) => line.trim());
  const row = (
    text: string,
    date: string,
    amountCents: number,
    categoryId = "expense",
  ) => ({
    sourceLine: lines.findIndex((line) => line.includes(text)) + 1,
    date,
    dateText: "irrelevant model date",
    amountCents,
    categoryId,
    description: "AI replacement",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rows: [
                    row("18-01-2026", "2026-01-18", 1234), // wrong debit sign
                    row("13-01-2026", "2026-01-13", 325), // refund expense category
                    row("06-01-2026", "2026-01-06", -750), // wallet amount on another source line
                    row("05-01-2026", "2026-01-05", 10000), // transfer cannot get an expense category
                    row("-9.99 AUD", "2026-01-05", -999), // missing date must not be borrowed
                  ],
                  opening: null,
                  closing: null,
                }),
              },
            },
          ],
        }),
      ),
    ),
  );
  const result = await readWithAi(
    pages,
    "household",
    [
      {
        id: "expense",
        name: "Shopping",
        kind: "expense",
        archived: false,
        color: "#ffffff",
      },
    ],
    "approved",
  );
  expect(result.rows.map((entry) => entry.amountCents)).toEqual([
    -1234, 325, -750, 10000, -2000,
  ]);
  expect(result.rows[0]).toMatchObject({
    categoryId: null,
    description: "PURCHASE EXAMPLE GROCER BRISBANE QLD",
  });
  expect(result.rows[1]).toMatchObject({
    kind: "refund",
    categoryId: "expense",
  });
  expect(result.rows[2]).toMatchObject({
    categoryId: "expense",
    amountCents: -750,
  });
  expect(result.rows[3]).toMatchObject({ kind: "transfer", categoryId: null });
  expect(result.details.opening?.amountCents).toBe(50000);
  expect(result.details.closing?.amountCents).toBe(55342);
  expect(
    result.details.lines.find((line) => line.text.includes("-9.99 AUD")),
  ).toMatchObject({ rowNumber: null, status: "review" });
});
