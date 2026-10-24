import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { bootstrapSchema, userInviteSchema } from "@finance/shared";
import { config } from "../../lib/config.js";
import { accessLock, prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
import { newGrant, tokenMatches, validGrant } from "./grants.js";
import { requireAdmin, requireUser } from "./middleware.js";
export const accessRouter = Router();
accessRouter.get("/status", async (_req, res) => {
  const setup = await prisma.setup.findUnique({ where: { id: 1 } });
  res.json({
    bootstrapAvailable: !setup?.completedAt,
    bootstrapConfigured: Boolean(config.FIRST_USER_TOKEN),
  });
});
accessRouter.post("/bootstrap", async (req, res) => {
  const input = bootstrapSchema.parse(req.body);
  if (
    !config.FIRST_USER_TOKEN ||
    !tokenMatches(input.token, config.FIRST_USER_TOKEN)
  )
    throw new HttpError(403, "Invalid setup information.");
  const result = await prisma.$transaction(async (tx) => {
    await accessLock(tx);
    if ((await tx.setup.findUnique({ where: { id: 1 } }))?.completedAt)
      throw new HttpError(409, "Setup is already complete.");
    await tx.registrationGrant.updateMany({
      where: { kind: "bootstrap", usedAt: null },
      data: { revokedAt: new Date() },
    });
    const existing = await tx.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing && existing.state !== "pending")
      throw new HttpError(409, "Choose another identity.");
    const user = await tx.user.upsert({
      where: { email: input.email.toLowerCase() },
      create: {
        id: randomUUID(),
        name: input.name,
        email: input.email.toLowerCase(),
        role: "admin",
        state: "pending",
      },
      update: { name: input.name },
    });
    const grant = await newGrant(tx, user.id, "bootstrap", 10 / 1440);
    return { context: grant.token, name: user.name, email: user.email };
  });
  res.set("Cache-Control", "no-store").json(result);
});
accessRouter.post("/exchange", async (req, res) => {
  const token = z.string().min(32).parse(req.body.token);
  const result = await prisma.$transaction(async (tx) => {
    await accessLock(tx);
    const grant = await validGrant(tx, token);
    if (grant.kind !== "invite")
      throw new HttpError(400, "This is not an invitation.");
    const enrolment = await newGrant(tx, grant.userId, "enrolment", 10 / 1440);
    return {
      context: enrolment.token,
      name: grant.user.name,
      email: grant.user.email,
    };
  });
  res.set("Cache-Control", "no-store").json(result);
});
accessRouter.use(requireUser);
accessRouter.get("/me", (_req, res) => {
  const { id, name, email, role, state } = res.locals.user;
  res.json({ id, name, email, role, state });
});
accessRouter.use(requireAdmin);
accessRouter.get("/users", async (_req, res) =>
  res.json(
    await prisma.user.findMany({
      where: { state: { notIn: ["deleted", "pending"] } },
      select: { id: true, name: true, email: true, role: true, state: true },
      orderBy: { createdAt: "asc" },
    }),
  ),
);
accessRouter.post("/users", async (req, res) => {
  const input = userInviteSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    await accessLock(tx);
    const actor = await tx.user.findUnique({
      where: { id: res.locals.user.id },
    });
    if (actor?.state !== "active" || actor.role !== "admin")
      throw new HttpError(403, "Administrator access required.");
    const user = await tx.user.create({
      data: {
        id: randomUUID(),
        ...input,
        email: input.email.toLowerCase(),
        state: "invited",
      },
    });
    const grant = await newGrant(tx, user.id, "invite", 7);
    await tx.auditEvent.create({
      data: {
        actorId: res.locals.user.id,
        action: "user.invite",
        subjectId: user.id,
      },
    });
    return {
      user,
      inviteUrl: config.BETTER_AUTH_URL + "/enrol#" + grant.token,
      expiresAt: grant.expiresAt,
    };
  });
  res.status(201).json(result);
});
accessRouter.post("/users/:id/:action", async (req, res) => {
  const action = z
    .enum(["role", "reinvite", "reset", "delete"])
    .parse(req.params.action);
  const targetId = z.uuid().parse(req.params.id);
  const result = await prisma.$transaction(async (tx) => {
    await accessLock(tx);
    const actor = await tx.user.findUnique({
      where: { id: res.locals.user.id },
    });
    if (actor?.state !== "active" || actor.role !== "admin")
      throw new HttpError(403, "Administrator access required.");
    const user = await tx.user.findUnique({ where: { id: targetId } });
    if (!user || user.state === "deleted")
      throw new HttpError(404, "User not found.");
    const role =
      action === "role"
        ? z.enum(["admin", "member"]).parse(req.body.role)
        : user.role;
    if (
      (action === "delete" || action === "reset" || role === "member") &&
      user.role === "admin" &&
      user.state === "active" &&
      (await tx.user.count({ where: { role: "admin", state: "active" } })) <= 1
    )
      throw new HttpError(409, "Keep at least one active administrator.");
    if (action === "reset" && targetId === actor.id)
      throw new HttpError(
        409,
        "Manage your own passkeys through the account menu.",
      );
    if (
      action === "reinvite" &&
      !["invited", "recovering"].includes(user.state)
    )
      throw new HttpError(409, "Use Reset access for an active user.");
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "user." + action,
        subjectId: targetId,
      },
    });
    if (action === "role") {
      await tx.session.deleteMany({ where: { userId: targetId } });
      await tx.user.update({ where: { id: targetId }, data: { role } });
      return { ok: true };
    }
    await tx.registrationGrant.updateMany({
      where: { userId: targetId, usedAt: null },
      data: { revokedAt: new Date() },
    });
    if (action === "reset" || action === "delete") {
      await tx.session.deleteMany({ where: { userId: targetId } });
      await tx.passkey.deleteMany({ where: { userId: targetId } });
    }
    if (action === "delete") {
      await tx.user.update({
        where: { id: targetId },
        data: { state: "deleted" },
      });
      return { ok: true };
    }
    if (action === "reset")
      await tx.user.update({
        where: { id: targetId },
        data: { state: "recovering" },
      });
    const grant = await newGrant(tx, targetId, "invite", 7);
    return {
      inviteUrl: config.BETTER_AUTH_URL + "/enrol#" + grant.token,
      expiresAt: grant.expiresAt,
    };
  });
  res.json(result);
});
