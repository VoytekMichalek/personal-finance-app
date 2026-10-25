import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

let enabled = false;

export function toggleDiagnostics() {
  enabled = !enabled;
  console.info(
    JSON.stringify({ level: "info", event: "diagnostics_changed", enabled }),
  );
}

// Opt-in troubleshooting uses an allowlist, never raw URLs, headers or bodies.
// Route patterns come from application code; unmatched paths are not echoed.
export const requestDiagnostics: RequestHandler = (req, res, next) => {
  if (enabled && !["/health", "/ready"].includes(req.path)) {
    const started = performance.now();
    const requestId = randomUUID();
    res.once("finish", () => {
      console.debug(
        JSON.stringify({
          level: "debug",
          event: "request_completed",
          requestId,
          method: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS",
          ].includes(req.method)
            ? req.method
            : "OTHER",
          route:
            typeof req.route?.path === "string" ? req.route.path : "unmatched",
          status: res.statusCode,
          durationMs: Math.round(performance.now() - started),
        }),
      );
    });
  }
  next();
};
