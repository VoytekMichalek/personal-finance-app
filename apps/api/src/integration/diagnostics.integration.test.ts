import "./fixtures.js";
import request from "supertest";
import { expect, it, vi } from "vitest";
import { app } from "../app.js";
import { toggleDiagnostics } from "../lib/diagnostics.js";
import { memberCookie, post } from "./fixtures.js";

it("enables safe request diagnostics without leaking inputs or logging health polls", async () => {
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  let diagnosticMode = false;
  try {
    expect((await request(app).get("/api/snapshot")).status).toBe(401);
    expect(debug).not.toHaveBeenCalled();
    toggleDiagnostics();
    diagnosticMode = true;
    expect(
      (
        await request(app)
          .get("/api/snapshot?token=SENSITIVE_QUERY")
          .set("Authorization", "Bearer SENSITIVE_HEADER")
      ).status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/access/users").set("Cookie", memberCookie))
        .status,
    ).toBe(403);
    expect((await post("/accounts", { secret: "SENSITIVE_BODY" })).status).toBe(
      400,
    );
    expect(
      (
        await request(app)
          .get("/api/SENSITIVE_PATH")
          .set("Cookie", memberCookie)
          .set("User-Agent", "SENSITIVE_BOT")
      ).status,
    ).toBe(404);
    const events = debug.mock.calls.map(([line]) => JSON.parse(line as string));
    expect(events.map((event) => event.status)).toEqual([401, 403, 400, 404]);
    expect(
      events.every((event) => event.level === "debug" && event.requestId),
    ).toBe(true);
    expect(JSON.stringify(debug.mock.calls)).not.toContain("SENSITIVE_");
    expect(JSON.stringify(debug.mock.calls)).not.toContain(memberCookie);
    for (const path of ["/ready", "/health", "/ready"])
      expect((await request(app).get(path)).status).toBe(200);
    expect(debug).toHaveBeenCalledTimes(4);
    toggleDiagnostics();
    diagnosticMode = false;
    await request(app).get("/api/snapshot");
    expect(debug).toHaveBeenCalledTimes(4);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    if (diagnosticMode) toggleDiagnostics();
    for (const spy of [debug, info, warn, error]) spy.mockRestore();
  }
});
