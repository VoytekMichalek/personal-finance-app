import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("../modules/integrations/credentials.js", () => ({
  getOpenRouterKey: async () => "synthetic-test-key",
}));
import { suggest, redact, approvedModels } from "./openrouter.js";
afterEach(() => vi.unstubAllGlobals());
describe("AI is advisory and validated", () => {
  it("redacts emails and long bank references", () =>
    expect(redact("shop person@example.com 1234 5678 9012")).toBe(
      "shop [email] [reference]",
    ));
  it("rejects non-approved model IDs without making a request", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await expect(suggest("invented-model", {})).rejects.toThrow("approved");
    expect(mock).not.toHaveBeenCalled();
  });
  it("uses restrictive provider routing and validates the returned schema", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify({ categories: [] }) } },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await suggest(approvedModels.models[0]!.id, { headers: ["Date"] }),
    ).toEqual({ categories: [] });
    const request = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(request.provider).toEqual({
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    expect(request.response_format.type).toBe("json_schema");
  });
  it("leaves failure recoverable when the model returns invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
          ),
        ),
    );
    await expect(suggest(approvedModels.models[0]!.id, {})).rejects.toThrow(
      "expected format",
    );
  });
});
