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
  account,
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
    const consumed = await newGrant(prisma, memberId, "invite", 1);
    await prisma.registrationGrant.update({
      where: { tokenHash: hash(consumed.token) },
      data: { usedAt: new Date() },
    });
    expect(
      (await post("/access/exchange", { token: consumed.token }, "")).status,
    ).toBe(401);
  });
  it("allows only one live bootstrap grant under concurrent attempts", async () => {
    await prisma.setup.update({
      where: { id: 1 },
      data: { completedAt: null },
    });
    const attempts = await Promise.all(
      ["First", "Second"].map((name) =>
        post(
          "/access/bootstrap",
          {
            name,
            email: name.toLowerCase() + "@example.test",
            token: config.FIRST_USER_TOKEN,
          },
          "",
        ),
      ),
    );
    expect(attempts.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await prisma.registrationGrant.count({
        where: { kind: "bootstrap", revokedAt: null, usedAt: null },
      }),
    ).toBe(1);
  });
  it("revokes a demoted administrator's session and enforces the new role", async () => {
    const other = await identity("admin");
    expect(
      (
        await post(
          "/access/users/" + other.id + "/role",
          { role: "member" },
          adminCookie,
        )
      ).status,
    ).toBe(200);
    expect((await agent(other.cookie)).status).toBe(401);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).role,
    ).toBe("member");
    // Restore the existing signed session as a fresh-session fixture: access must
    // use the stored role, not an old role carried in client state.
    const { makeSignature } = await import("better-auth/crypto");
    const token = randomUUID();
    await prisma.session.create({
      data: {
        id: randomUUID(),
        token,
        userId: other.id,
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const cookie =
      "better-auth.session_token=" +
      encodeURIComponent(
        token + "." + (await makeSignature(token, config.BETTER_AUTH_SECRET)),
      );
    expect((await agent(cookie)).status).toBe(200);
    expect(
      (await request(app).get("/api/access/users").set("Cookie", cookie))
        .status,
    ).toBe(403);
  });
  it("deletes access while retaining household transactions and audit history", async () => {
    const accountId = await account();
    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        kind: "expense",
        amountCents: -1234n,
        date: "2026-10-01",
        description: "Retained history",
        owner: memberId,
      },
    });
    expect(
      (await post("/access/users/" + memberId + "/delete", {}, adminCookie))
        .status,
    ).toBe(200);
    expect((await agent(memberCookie)).status).toBe(401);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: memberId } })).state,
    ).toBe("deleted");
    expect(
      await prisma.transaction.findUnique({ where: { id: transaction.id } }),
    ).toEqual(transaction);
    expect(
      await prisma.auditEvent.count({
        where: { subjectId: memberId, action: "user.delete" },
      }),
    ).toBe(1);
  });
  it("rejects deleting and demoting the final active administrator", async () => {
    expect(
      (await post("/access/users/" + adminId + "/delete", {}, adminCookie))
        .status,
    ).toBe(409);
    expect(
      (
        await post(
          "/access/users/" + adminId + "/role",
          { role: "member" },
          adminCookie,
        )
      ).status,
    ).toBe(409);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: adminId } }),
    ).toMatchObject({ role: "admin", state: "active" });
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
