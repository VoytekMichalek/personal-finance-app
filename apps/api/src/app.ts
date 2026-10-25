import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { config, projectRoot } from "./lib/config.js";
import { prisma } from "./lib/db.js";
import { HttpError, errorHandler } from "./lib/errors.js";
import { metadata } from "./lib/metadata.js";
import { authHandler } from "./modules/access/auth.js";
import { accessRouter } from "./modules/access/routes.js";
import { requireUser } from "./modules/access/middleware.js";
import { financeRouter } from "./modules/finance/routes.js";
import { importRouter } from "./modules/imports/routes.js";
import { receiptRouter } from "./modules/receipts/routes.js";
import { integrationRouter } from "./modules/integrations/routes.js";
import { statementRouter } from "./modules/statements/routes.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'self'"],
        frameSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }),
);
app.use(express.json({ limit: "6mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.set("Cache-Control", "no-store");
    res.set("X-Release-Tag", metadata.releaseTag);
    res.set("X-Build-Commit", metadata.buildCommit);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, _res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== config.BETTER_AUTH_URL
  )
    throw new HttpError(403, "Request origin is not trusted.");
  next();
});
const accessLimit = rateLimit({
  skip: (req) =>
    req.method === "GET" ||
    (!req.originalUrl.startsWith("/api/auth") &&
      !["/api/access/bootstrap", "/api/access/exchange"].includes(
        req.originalUrl,
      )),
  windowMs: 60000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many access attempts. Try again shortly." },
});
app.use("/api/auth", accessLimit, authHandler);
app.use("/api/access", accessLimit, accessRouter);
app.use("/api", requireUser);
app.use("/api", financeRouter, receiptRouter, statementRouter);
app.use(
  "/api/imports",
  rateLimit({
    keyGenerator: (_req, res) => res.locals.user.id,
    windowMs: 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Please wait before another import request." },
  }),
  importRouter,
);
app.get("/api/system", (_req, res) => res.json(metadata));
app.use("/api", integrationRouter);
app.get("/api/documentation", (_req, res) =>
  res.json({
    content: fs.readFileSync(
      path.join(projectRoot, "docs/user-guide/index.md"),
      "utf8",
    ),
  }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API route not found." }),
);
const publicDir = path.join(projectRoot, "apps/web/dist");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: 0 }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(publicDir, "index.html")),
  );
}
app.use(errorHandler);
