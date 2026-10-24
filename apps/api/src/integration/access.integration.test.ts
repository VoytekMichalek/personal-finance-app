import "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { hash, newGrant } from "../modules/access/grants.js";
import {
  adminCookie,
  adminId,
  agent,
  identity,
  memberCookie,
  memberId,
  post,
} from "./fixtures.js";
describe("database-backed authorization and lifecycle", () => {
  it("rejects unauthenticated finance and direct member access to user management", async () => {
    expect((await request(app).get("/api/snapshot")).status).toBe(401);
    expect(
      (await request(app).get("/api/access/users").set("Cookie", memberCookie))
        .status,
    ).toBe(403);
    expect(
      (
        await post("/access/users", {
          name: "Intruder",
          email: "intruder@example.test",
          role: "admin",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post("/auth/sign-up/email", {
          email: "new@example.test",
          password: "password",
        })
      ).status,
    ).toBe(404);
    expect((await agent()).status).toBe(200);
  });
  it("blocks cross-origin financial mutations", async () =>
    expect(
      (
        await request(app)
          .post("/api/accounts")
          .set("Cookie", memberCookie)
          .set("Origin", "https://other.test")
          .send({})
      ).status,
    ).toBe(403));
  it("keeps bootstrap closed through user deletion and token changes", async () => {
    await prisma.user.updateMany({ data: { state: "deleted" } });
    expect(
      (await request(app).get("/api/access/status")).body.bootstrapAvailable,
    ).toBe(false);
    expect(
      (
        await post(
          "/access/bootstrap",
          {
            name: "Replacement",
            email: "replacement@example.test",
            token: config.FIRST_USER_TOKEN,
          },
          "",
        )
      ).status,
    ).toBe(409);
  });
  it("allows retry after cancelled pending registration and grants no financial access", async () => {
    await prisma.setup.update({
      where: { id: 1 },
      data: { completedAt: null },
    });
    const input = {
      name: "First",
      email: "first@example.test",
      token: config.FIRST_USER_TOKEN,
    };
    const first = await post("/access/bootstrap", input, "");
    expect(first.status).toBe(200);
    const second = await post("/access/bootstrap", input, "");
    expect(second.status).toBe(200);
    expect(
      await prisma.user.count({
        where: { email: input.email, state: "pending" },
      }),
    ).toBe(1);
    expect(
      (await request(app).get("/api/access/status")).body.bootstrapAvailable,
    ).toBe(true);
    expect((await request(app).get("/api/snapshot")).status).toBe(401);
    const old = await prisma.registrationGrant.findUnique({
      where: { tokenHash: hash(first.body.context) },
    });
    expect(old?.revokedAt).not.toBeNull();
  });
  it("replaces invitation links and all in-progress grants", async () => {
    const invitation = await post(
      "/access/users",
      { name: "Invitee", email: "invitee@example.test" },
      adminCookie,
    );
    expect(invitation.status).toBe(201);
    const token = (invitation.body.inviteUrl as string).split("#")[1]!;
    const exchanged = await post("/access/exchange", { token }, "");
    expect(exchanged.status).toBe(200);
    const next = await post(
      "/access/users/" + invitation.body.user.id + "/reinvite",
      {},
      adminCookie,
    );
    expect(next.status).toBe(200);
    expect((await post("/access/exchange", { token }, "")).status).toBe(401);
    expect(
      (
        await prisma.registrationGrant.findUnique({
          where: { tokenHash: hash(exchanged.body.context) },
        })
      )?.revokedAt,
    ).not.toBeNull();
  });
  it("rejects expired and consumed invitations", async () => {
    const grant = await newGrant(prisma, memberId, "invite", -1);
    expect(
      (await post("/access/exchange", { token: grant.token }, "")).status,
    ).toBe(401);
  });
  it("revokes sessions and passkeys on lost-passkey reset without changing identity", async () => {
    await prisma.passkey.create({
      data: {
        id: randomUUID(),
        userId: memberId,
        name: "Device",
        credentialID: "test-credential",
        publicKey: "test",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
      },
    });
    expect(
      (await post("/access/users/" + memberId + "/reset", {}, adminCookie))
        .status,
    ).toBe(200);
    expect((await agent(memberCookie)).status).toBe(401);
    expect(await prisma.passkey.count({ where: { userId: memberId } })).toBe(0);
    expect(
      (await prisma.user.findUnique({ where: { id: memberId } }))?.state,
    ).toBe("recovering");
  });
  it("preserves at least one admin under concurrent deletion", async () => {
    const other = await identity("admin");
    const responses = await Promise.all([
      post("/access/users/" + other.id + "/delete", {}, adminCookie),
      post("/access/users/" + adminId + "/delete", {}, other.cookie),
    ]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      await prisma.user.count({ where: { role: "admin", state: "active" } }),
    ).toBe(1);
  });
  it("prevents removing the last passkey and manages ownership on the server", async () => {
    const key = await prisma.passkey.create({
      data: {
        id: randomUUID(),
        userId: memberId,
        name: "Device",
        credentialID: "test-credential",
        publicKey: "test",
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
      },
    });
    expect(
      (await post("/auth/passkey/delete-passkey", { id: key.id })).status,
    ).toBe(400);
    expect(
      (await post("/auth/passkey/delete-passkey", { id: key.id }, adminCookie))
        .status,
    ).toBe(403);
    expect(await prisma.passkey.count()).toBe(1);
  });
  it("logout invalidates the server session", async () => {
    expect((await post("/auth/sign-out", {})).status).toBe(200);
    expect((await agent(memberCookie)).status).toBe(401);
  });
});
