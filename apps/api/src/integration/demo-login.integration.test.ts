import { afterEach, expect, it, vi } from "vitest";
// Exercise the real session/cookie flow on finance_test, never resetting demo
// data. Unit coverage separately verifies the unmocked environment boundary.
vi.mock("../modules/access/demo-policy.js", async (original) => ({
  ...(await original<typeof import("../modules/access/demo-policy.js")>()),
  demoLoginEnabled: () => true,
}));
import "./fixtures.js";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { origin } from "./fixtures.js";

const login = () =>
  request(app)
    .post("/api/auth/demo-login")
    .set("Origin", origin)
    .set("Host", new URL(origin).host)
    .send({});
const cookies = (response: request.Response) =>
  (response.headers["set-cookie"] as unknown as string[])
    .map((value) => value.split(";")[0])
    .join("; ");
afterEach(() => vi.restoreAllMocks());

it("creates a distinct demo admin with an expiring Better Auth session and revocable logout", async () => {
  const response = await login();
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
  const cookie = cookies(response);
  expect(cookie).toContain("finance-demo.session_token=");
  expect(response.headers["set-cookie"].join(";")).toMatch(/httponly/i);
  const me = await request(app).get("/api/access/me").set("Cookie", cookie);
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({
    name: "Demo Admin",
    role: "admin",
    state: "active",
  });
  expect(
    (await request(app).get("/api/access/users").set("Cookie", cookie)).status,
  ).toBe(200);
  const session = await prisma.session.findFirstOrThrow({
    where: { userId: me.body.id },
  });
  expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(3500000);
  expect(session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600000);
  expect(
    await prisma.auditEvent.count({
      where: { action: "demo.login", actorId: me.body.id },
    }),
  ).toBe(1);
  const logout = await request(app)
    .post("/api/auth/sign-out")
    .set("Origin", origin)
    .set("Cookie", cookie)
    .send({});
  expect(logout.status).toBe(200);
  expect(
    (await request(app).get("/api/access/me").set("Cookie", cookie)).status,
  ).toBe(401);
  expect(
    await prisma.session.findUnique({ where: { id: session.id } }),
  ).toBeNull();
});

it("rejects foreign hosts, cross-origin requests and expired sessions", async () => {
  expect(
    (
      await request(app)
        .post("/api/auth/demo-login")
        .set("Origin", origin)
        .set("Host", "other.example")
        .send({})
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post("/api/auth/demo-login")
        .set("Origin", "http://other.example")
        .send({})
    ).status,
  ).toBe(403);
  const response = await login();
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@finance-demo.invalid" },
  });
  // Controlled expired database records test the server boundary without sleeps.
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { expiresAt: new Date(0) },
  });
  expect(
    (await request(app).get("/api/access/me").set("Cookie", cookies(response)))
      .status,
  ).toBe(401);
});

it("does not reactivate or promote a disabled demo identity", async () => {
  await login();
  await prisma.user.update({
    where: { email: "admin@finance-demo.invalid" },
    data: { state: "deleted", role: "member" },
  });
  expect((await login()).status).toBe(403);
  expect(
    await prisma.user.findUnique({
      where: { email: "admin@finance-demo.invalid" },
    }),
  ).toMatchObject({ state: "deleted", role: "member" });
});
