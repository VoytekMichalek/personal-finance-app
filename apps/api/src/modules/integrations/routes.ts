import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAdmin } from "../access/middleware.js";
import {
  integrationStatus,
  saveAiSettings,
  removeAiKey,
  checkAiKey,
} from "./service.js";
export const integrationRouter = Router();
integrationRouter.get("/integrations", async (_req, res) =>
  res.json(await integrationStatus()),
);
integrationRouter.put("/integrations/ai", requireAdmin, async (req, res) => {
  await saveAiSettings(req.body);
  res.json({ ok: true });
});
integrationRouter.delete(
  "/integrations/ai/key",
  requireAdmin,
  async (_req, res) => {
    await removeAiKey();
    res.json({ ok: true });
  },
);
integrationRouter.post(
  "/integrations/ai/check",
  requireAdmin,
  rateLimit({
    keyGenerator: (_req, res) => res.locals.user.id,
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Please wait before checking the key again." },
  }),
  async (req, res) => {
    await checkAiKey(req.body);
    res.json({ ok: true });
  },
);
