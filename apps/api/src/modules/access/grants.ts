import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { APIError } from "better-auth/api";
import type { DB } from "../../lib/db.js";
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export function tokenMatches(value: string, expected: string) {
  return timingSafeEqual(Buffer.from(hash(value)), Buffer.from(hash(expected)));
}
export async function validGrant(db: DB, token: unknown) {
  if (typeof token !== "string" || token.length < 32)
    throw new APIError("UNAUTHORIZED", {
      message: "Invalid or expired registration. Ask for a new invitation.",
    });
  const grant = await db.registrationGrant.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (
    !grant ||
    grant.usedAt ||
    grant.revokedAt ||
    grant.expiresAt <= new Date() ||
    grant.user.state === "deleted"
  )
    throw new APIError("UNAUTHORIZED", {
      message: "Invalid or expired registration. Ask for a new invitation.",
    });
  if (
    grant.kind === "bootstrap" &&
    (await db.setup.findUnique({ where: { id: 1 } }))?.completedAt
  )
    throw new APIError("FORBIDDEN", { message: "Setup is already complete." });
  return grant;
}
export async function newGrant(
  db: DB,
  userId: string,
  kind: string,
  days: number,
) {
  const token = secret();
  const expiresAt = new Date(Date.now() + days * 86400000);
  await db.registrationGrant.create({
    data: { userId, kind, tokenHash: hash(token), expiresAt },
  });
  return { token, expiresAt };
}
