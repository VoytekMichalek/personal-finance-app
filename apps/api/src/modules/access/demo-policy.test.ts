import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
// Policy units use explicit synthetic settings and must not load developer or
// deployment credentials. Real configuration/session boundaries live in API tests.
vi.mock("../../lib/config.js", () => ({
  config: {
    DATABASE_URL: "postgresql://demo:demo@127.0.0.1:55432/finance_demo",
    BETTER_AUTH_URL: "http://localhost:5174",
    BETTER_AUTH_SECRET: "synthetic-unit-only-secret-not-used-for-auth",
  },
}));
import { config } from "../../lib/config.js";
import { demoLoginEnabled, localDemoRequest } from "./demo-policy.js";

const env = { NODE_ENV: "development", FINANCE_DEMO_LOGIN: "1" };
const settings = {
  ...config,
  DATABASE_URL: "postgresql://demo:demo@127.0.0.1:55432/finance_demo",
  BETTER_AUTH_URL: "http://localhost:5174",
};
describe("local demo sign-in boundary", () => {
  it("requires explicit development mode and a local demo database and origin", () => {
    expect(demoLoginEnabled(env, settings)).toBe(true);
  });
  it.each(["production", "test", "", undefined])(
    "rejects NODE_ENV=%s",
    (NODE_ENV) => {
      expect(demoLoginEnabled({ ...env, NODE_ENV }, settings)).toBe(false);
    },
  );
  it.each([undefined, "0", "true"])(
    "rejects opt-in=%s",
    (FINANCE_DEMO_LOGIN) => {
      expect(demoLoginEnabled({ ...env, FINANCE_DEMO_LOGIN }, settings)).toBe(
        false,
      );
    },
  );
  it.each([
    "postgresql://demo:demo@127.0.0.1/finance",
    "postgresql://demo:demo@127.0.0.1/finance_test",
    "postgresql://demo:demo@db.example/finance_demo",
    "postgresql://demo:demo@localhost.example/finance_demo",
    "invalid",
  ])("rejects database %s", (DATABASE_URL) => {
    expect(demoLoginEnabled(env, { ...settings, DATABASE_URL })).toBe(false);
  });
  it.each([
    "https://finance.example",
    "http://localhost.example",
    "http://localhost/path",
    "http://user@localhost",
    "invalid",
  ])("rejects origin %s", (BETTER_AUTH_URL) => {
    expect(demoLoginEnabled(env, { ...settings, BETTER_AUTH_URL })).toBe(false);
  });
  it("rejects remote sockets and foreign hosts without trusting forwarded headers", () => {
    const request = (address: string, host: string) =>
      ({
        socket: { remoteAddress: address },
        get: () => host,
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "x-forwarded-host": "localhost",
        },
      }) as unknown as Request;
    const host = new URL(config.BETTER_AUTH_URL).host;
    expect(localDemoRequest(request("127.0.0.1", host))).toBe(true);
    expect(localDemoRequest(request("192.0.2.2", host))).toBe(false);
    expect(localDemoRequest(request("127.0.0.1", "other.example"))).toBe(false);
  });
});
