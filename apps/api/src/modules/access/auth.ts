import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { passkey } from "@better-auth/passkey";
import { APIError, getSessionFromCtx } from "better-auth/api";
import type { Request, Response } from "express";
import { config } from "../../lib/config.js";
import { accessLock, prisma, type DB } from "../../lib/db.js";
import { validGrant } from "./grants.js";
export function makeAuth(db: DB) {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql", transaction: false }),
    baseURL: config.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.BETTER_AUTH_URL],
    emailAndPassword: { enabled: false },
    account: { modelName: "AuthAccount" },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "member", input: false },
        state: { type: "string", defaultValue: "invited", input: false },
      },
    },
    session: { cookieCache: { enabled: false } },
    logger: { disabled: true },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (
              (await db.user.findUnique({ where: { id: session.userId } }))
                ?.state !== "active"
            )
              throw new APIError("FORBIDDEN", {
                message: "This account is not active.",
              });
            return { data: session };
          },
        },
      },
    },
    plugins: [
      passkey({
        rpID: new URL(config.BETTER_AUTH_URL).hostname,
        rpName: "Personal Finance",
        origin: config.BETTER_AUTH_URL,
        registration: {
          requireSession: false,
          resolveUser: async ({ context }) => {
            const grant = await validGrant(db, context);
            return {
              id: grant.userId,
              name: grant.user.email,
              displayName: grant.user.name,
            };
          },
          afterVerification: async ({ context, user, ctx }) => {
            if (!context) {
              const session = await getSessionFromCtx(ctx);
              if (
                session?.user.id !== user.id ||
                (await db.user.findUnique({ where: { id: user.id } }))
                  ?.state !== "active"
              )
                throw new APIError("UNAUTHORIZED");
              return;
            }
            const grant = await validGrant(db, context);
            if (grant.userId !== user.id) throw new APIError("FORBIDDEN");
            if (grant.kind === "bootstrap")
              await db.setup.upsert({
                where: { id: 1 },
                create: { id: 1, completedAt: new Date() },
                update: { completedAt: new Date() },
              });
            await db.user.update({
              where: { id: user.id },
              data: { state: "active" },
            });
            await db.registrationGrant.updateMany({
              where: { userId: user.id, usedAt: null, revokedAt: null },
              data: { usedAt: new Date() },
            });
            return { userId: user.id };
          },
        },
      }),
    ],
  });
}
export const auth = makeAuth(prisma);
export function requestHeaders(request: Request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers))
    if (value)
      headers.set(name, Array.isArray(value) ? value.join(",") : value);
  return headers;
}
const allowed = new Set([
  "/get-session",
  "/sign-out",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/list-user-passkeys",
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
]);
class AuthRollback extends Error {
  constructor(public response: globalThis.Response) {
    super("Auth request rolled back");
  }
}
export async function authHandler(request: Request, response: Response) {
  const path = request.path.replace("/api/auth", "");
  if (!allowed.has(path)) {
    response.status(404).json({ error: "Not found" });
    return;
  }
  const incoming = new globalThis.Request(
    new URL(request.originalUrl, config.BETTER_AUTH_URL),
    {
      method: request.method,
      headers: requestHeaders(request),
      ...(request.method === "GET"
        ? {}
        : { body: JSON.stringify(request.body) }),
    },
  );
  let result: globalThis.Response;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        await accessLock(tx);
        const instance = makeAuth(tx);
        if (path === "/passkey/delete-passkey") {
          const session = await instance.api.getSession({
            headers: requestHeaders(request),
          });
          if (!session) throw new APIError("UNAUTHORIZED");
          if (
            !(await tx.passkey.findFirst({
              where: { id: request.body.id, userId: session.user.id },
            }))
          )
            throw new APIError("FORBIDDEN");
          if (
            (await tx.passkey.count({ where: { userId: session.user.id } })) <=
            1
          )
            throw new APIError("BAD_REQUEST", {
              message:
                "Add a replacement passkey before removing your last one.",
            });
        }
        const answer = await instance.handler(incoming);
        if (answer.status >= 400) throw new AuthRollback(answer);
        return answer;
      },
      { maxWait: 10000, timeout: 20000 },
    );
  } catch (error) {
    if (error instanceof AuthRollback) result = error.response;
    else if (error instanceof APIError) {
      // Better Auth's client reads `message`; using the application's generic
      // `error` envelope hides safeguards such as the last-passkey explanation.
      response.status(error.statusCode).json({ message: error.message });
      return;
    } else throw error;
  }
  if (result.status >= 500)
    console.error(
      JSON.stringify({
        level: "error",
        event: "auth_request_failed",
        type: "AuthHandlerError",
      }),
    );
  for (const [key, value] of result.headers)
    if (key !== "set-cookie") response.setHeader(key, value);
  const cookies = result.headers.getSetCookie();
  if (cookies.length) response.setHeader("set-cookie", cookies);
  response.status(result.status).send(Buffer.from(await result.arrayBuffer()));
}
