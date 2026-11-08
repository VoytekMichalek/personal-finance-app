import { randomUUID } from "node:crypto";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { DB } from "../../lib/db.js";
import { demoLoginEnabled } from "./demo-policy.js";

// Only registered by the guarded local demo process. Better Auth still owns
// the session, cookie, expiry and logout; protected routes keep their checks.
export function demoLoginPlugin(db: DB) {
  return {
    id: "local-demo-login",
    endpoints: {
      demoLogin: createAuthEndpoint(
        "/demo-login",
        { method: "POST" },
        async (ctx) => {
          if (!demoLoginEnabled()) throw new APIError("NOT_FOUND");
          const user = await db.user.upsert({
            where: { email: "admin@finance-demo.invalid" },
            create: {
              id: randomUUID(),
              name: "Demo Admin",
              email: "admin@finance-demo.invalid",
              role: "admin",
              state: "active",
            },
            update: {},
          });
          if (user.state !== "active" || user.role !== "admin")
            throw new APIError("FORBIDDEN", {
              message:
                "The demo administrator is disabled. Use a local administrator’s passkey to restore their access in Settings → Users, then retry.",
            });
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            true,
            {
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
            true,
          );
          await setSessionCookie(ctx, { session, user }, true);
          await db.auditEvent.create({
            data: {
              actorId: user.id,
              action: "demo.login",
              subjectId: user.id,
            },
          });
          return ctx.json({ ok: true });
        },
      ),
    },
  };
}
