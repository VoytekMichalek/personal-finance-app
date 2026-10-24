import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { adminCookie, memberCookie, origin, put, post } from "./fixtures.js";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { approvedModels, suggest } from "../integrations/openrouter.js";
import {
  decryptKey,
  getOpenRouterKey,
} from "../modules/integrations/credentials.js";
const modelId = approvedModels.models[0]!.id;
const key = "synthetic-private-openrouter-key";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("persists encrypted credentials, leaves a blank replacement unchanged, and immediately uses the saved key", async () => {
  expect(
    (await put("/integrations/ai", { modelId, apiKey: key }, adminCookie))
      .status,
  ).toBe(200);
  const saved = (await prisma.setup.findUniqueOrThrow({ where: { id: 1 } }))
    .openrouterKeyEncrypted!;
  expect(saved).not.toContain(key);
  expect(decryptKey(saved)).toBe(key);
  const status = await request(app)
    .get("/api/integrations")
    .set("Cookie", memberCookie);
  expect(status.body).toMatchObject({
    modelId,
    keySource: "settings",
    openrouterConfigured: true,
  });
  expect(status.text).not.toContain(key);
  expect(status.text).not.toContain(saved);
  expect(
    (await put("/integrations/ai", { modelId: null }, adminCookie)).status,
  ).toBe(200);
  expect(await getOpenRouterKey()).toBe(key);
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"categories":[]}' } }],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  await suggest(modelId, {});
  expect(fetcher.mock.calls[0]![1].headers.Authorization).toBe("Bearer " + key);
  expect(
    (
      await request(app)
        .delete("/api/integrations/ai/key")
        .set("Origin", origin)
        .set("Cookie", adminCookie)
    ).status,
  ).toBe(200);
  expect(await getOpenRouterKey()).toBeUndefined();
});
it("restricts credential writes, checks and removal to administrators and trusted origins", async () => {
  expect((await put("/integrations/ai", { modelId, apiKey: key })).status).toBe(
    403,
  );
  expect((await post("/integrations/ai/check", { apiKey: key })).status).toBe(
    403,
  );
  expect(
    (
      await request(app)
        .delete("/api/integrations/ai/key")
        .set("Origin", origin)
        .set("Cookie", memberCookie)
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .put("/api/integrations/ai")
        .set("Origin", "https://untrusted.test")
        .set("Cookie", adminCookie)
        .send({ modelId, apiKey: key })
    ).status,
  ).toBe(403);
  expect((await request(app).get("/api/integrations")).status).toBe(401);
  expect(
    (
      await put(
        "/integrations/ai",
        { modelId: "invented", apiKey: key },
        adminCookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await put(
        "/integrations/ai",
        { modelId, apiKey: "bad\nkey" },
        adminCookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (await prisma.setup.findUniqueOrThrow({ where: { id: 1 } }))
      .openrouterKeyEncrypted,
  ).toBeNull();
});
it("checks a draft or saved key without exposing provider metadata, and sanitises rejection/network errors", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: { label: key } })));
  vi.stubGlobal("fetch", fetcher);
  const checked = await post(
    "/integrations/ai/check",
    { apiKey: key },
    adminCookie,
  );
  expect(checked.status).toBe(200);
  expect(checked.body).toEqual({ ok: true });
  expect(fetcher.mock.calls[0]![0]).toBe("https://openrouter.ai/api/v1/key");
  expect(
    (await prisma.setup.findUniqueOrThrow({ where: { id: 1 } }))
      .openrouterKeyEncrypted,
  ).toBeNull();
  await put("/integrations/ai", { apiKey: key, modelId }, adminCookie);
  fetcher.mockResolvedValueOnce(
    new Response("private provider info", { status: 401 }),
  );
  const rejected = await post("/integrations/ai/check", {}, adminCookie);
  expect(rejected.status).toBe(400);
  expect(rejected.text).not.toContain("private provider info");
  fetcher.mockRejectedValueOnce(new Error(key));
  const failed = await post("/integrations/ai/check", {}, adminCookie);
  expect(failed.status).toBe(503);
  expect(failed.text).not.toContain(key);
});
it("fails closed for damaged encryption and can replace a key after secret rotation", async () => {
  await put("/integrations/ai", { modelId, apiKey: key }, adminCookie);
  const oldSecret = config.BETTER_AUTH_SECRET;
  try {
    config.BETTER_AUTH_SECRET = "rotated-test-secret-at-least-32-characters";
    await expect(getOpenRouterKey()).rejects.toThrow("Re-enter");
    await put("/integrations/ai", { modelId, apiKey: key }, adminCookie);
    expect(await getOpenRouterKey()).toBe(key);
  } finally {
    config.BETTER_AUTH_SECRET = oldSecret;
  }
});
it("keeps the optional server key as a fallback and lets Settings override it", async () => {
  const original = config.OPENROUTER_API_KEY;
  try {
    expect((await post("/integrations/ai/check", {}, adminCookie)).status).toBe(
      400,
    );
    config.OPENROUTER_API_KEY = "synthetic-environment-key";
    expect(await getOpenRouterKey()).toBe("synthetic-environment-key");
    await put("/integrations/ai", { modelId, apiKey: key }, adminCookie);
    expect(await getOpenRouterKey()).toBe(key);
    await request(app)
      .delete("/api/integrations/ai/key")
      .set("Origin", origin)
      .set("Cookie", adminCookie);
    expect(await getOpenRouterKey()).toBe("synthetic-environment-key");
    const status = await request(app)
      .get("/api/integrations")
      .set("Cookie", adminCookie);
    expect(status.body.keySource).toBe("environment");
    expect(status.text).not.toContain("synthetic-environment-key");
  } finally {
    config.OPENROUTER_API_KEY = original;
  }
});
