import { beforeAll, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID, randomBytes } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
const objects = vi.hoisted(() => new Map<string, Uint8Array>());
const storageMock = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../integrations/storage.js", () => ({ storage: storageMock }));
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { today } from "@finance/shared";
export let adminId: string;
export let memberId: string;
export let adminCookie: string;
export let memberCookie: string;
export const origin = config.BETTER_AUTH_URL;
export async function identity(role: "admin" | "member") {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: role + " test",
      email: randomUUID() + "@example.test",
      role,
      state: "active",
    },
  });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      id: randomUUID(),
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return {
    id: user.id,
    cookie:
      "better-auth.session_token=" +
      encodeURIComponent(
        token + "." + (await makeSignature(token, config.BETTER_AUTH_SECRET)),
      ),
  };
}
export const agent = (cookie = memberCookie) =>
  request(app).get("/api/snapshot").set("Cookie", cookie);
export function post(
  path: string,
  body: Record<string, unknown>,
  cookie = memberCookie,
) {
  return request(app)
    .post("/api" + path)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send(body);
}
export function put(
  path: string,
  body: Record<string, unknown>,
  cookie = memberCookie,
) {
  return request(app)
    .put("/api" + path)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .send(body);
}
export async function account() {
  return (
    await post("/accounts", {
      name: "Everyday",
      type: "bank",
      openingDate: today(),
      openingBalanceCents: 100000,
    })
  ).body.id as string;
}
beforeAll(() => {
  if (!/\/(finance_test|app_test)(\?|$)/.test(config.DATABASE_URL))
    throw new Error("Integration suite requires an isolated test database.");
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditEvent","RegistrationGrant","Passkey","Session","AuthAccount","Verification","User","Receipt","Transaction","ImportBatch","Account","Budget","Rule","Schedule","Valuation","Asset","ImportMapping","Setup" RESTART IDENTITY CASCADE',
  );
  const admin = await identity("admin");
  const member = await identity("member");
  adminId = admin.id;
  memberId = member.id;
  adminCookie = admin.cookie;
  memberCookie = member.cookie;
  await prisma.setup.create({ data: { id: 1, completedAt: new Date() } });
  vi.clearAllMocks();
  objects.clear();
  storage.put.mockImplementation(async (key: string, bytes: Uint8Array) => {
    objects.set(key, bytes);
  });
  storage.get.mockImplementation(async (key: string) => ({
    Body: { transformToByteArray: async () => objects.get(key) },
  }));
  storage.remove.mockImplementation(async (key: string) => {
    objects.delete(key);
  });
});
afterAll(() => prisma.$disconnect());

export const storage = storageMock;
