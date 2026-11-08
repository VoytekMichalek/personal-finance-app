import type { Request } from "express";
import { config } from "../../lib/config.js";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function demoLoginEnabled(env = process.env, settings = config) {
  if (env.NODE_ENV !== "development" || env.FINANCE_DEMO_LOGIN !== "1")
    return false;
  try {
    const database = new URL(settings.DATABASE_URL);
    const origin = new URL(settings.BETTER_AUTH_URL);
    return (
      localHosts.has(database.hostname) &&
      database.pathname === "/finance_demo" &&
      ["postgres:", "postgresql:"].includes(database.protocol) &&
      localHosts.has(origin.hostname) &&
      origin.protocol === "http:" &&
      origin.pathname === "/" &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash
    );
  } catch {
    return false;
  }
}

export function localDemoRequest(request: Request) {
  return (
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      request.socket.remoteAddress ?? "",
    ) && request.get("host") === new URL(config.BETTER_AUTH_URL).host
  );
}
