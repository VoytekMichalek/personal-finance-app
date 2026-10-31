import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ extract: vi.fn(), ai: vi.fn() }));
vi.mock("./pdf.js", () => ({ extractPdf: mocks.extract }));
vi.mock("./ai-reader.js", () => ({ readWithAi: mocks.ai }));
import { readStatement } from "./read.js";
const pages = [
  "Bank statement 2026\nOpening balance 100.00\n01/01/2026 Local Shop -10.00\nClosing balance 90.00",
];
const content = Buffer.from("%PDF-test");
const run = (useAi = false) =>
  readStatement(
    content,
    "household",
    [],
    "bank",
    { useAi, modelId: useAi ? "test" : null },
    vi.fn(),
  );
beforeEach(() => vi.resetAllMocks());
it("automatically scans transaction images when selectable header text yielded no rows", async () => {
  mocks.extract
    .mockResolvedValueOnce([
      "Bank statement with selectable header text but scanned transaction table",
    ])
    .mockResolvedValueOnce(pages);
  const result = await run();
  expect(mocks.extract.mock.calls).toEqual([[content], [content, true]]);
  expect(result.rows).toMatchObject([
    { date: "2026-01-01", description: "Local Shop", amountCents: -1000 },
  ]);
  expect(result.details.warnings.join(" ")).toContain(
    "Scanned pages were read automatically",
  );
});
it("recovers an empty AI result from printed source data in the initial job", async () => {
  mocks.extract.mockResolvedValue(pages);
  mocks.ai.mockResolvedValue({ rows: [], details: {} });
  const result = await run(true);
  expect(result.rows).toHaveLength(1);
  expect(result.details.warnings.join(" ")).toContain(
    "AI returned no transactions",
  );
  expect(mocks.extract).toHaveBeenCalledTimes(1);
});
it("reports an unreadable statement after one scan attempt instead of saving an empty ready review", async () => {
  mocks.extract.mockResolvedValue(["No transaction table"]);
  await expect(run()).rejects.toThrow(
    "No transactions were found after reading the PDF text and scanning its pages",
  );
  expect(mocks.extract).toHaveBeenCalledTimes(2);
});
it("uses ordinary text extraction without unnecessary OCR or AI requests", async () => {
  mocks.extract.mockResolvedValue(pages);
  expect((await run()).rows).toHaveLength(1);
  expect(mocks.extract).toHaveBeenCalledTimes(1);
  expect(mocks.ai).not.toHaveBeenCalled();
});
