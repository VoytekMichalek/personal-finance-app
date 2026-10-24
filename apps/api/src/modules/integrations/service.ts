import { aiSettingsSchema, aiKeyCheckSchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { config, r2Ready } from "../../lib/config.js";
import { HttpError } from "../../lib/errors.js";
import { approvedModels } from "../../integrations/openrouter.js";
import { encryptKey, getOpenRouterKey } from "./credentials.js";
export async function integrationStatus() {
  const setup = await prisma.setup.findUnique({ where: { id: 1 } });
  return {
    openrouterConfigured: Boolean(
      setup?.openrouterKeyEncrypted || config.OPENROUTER_API_KEY,
    ),
    keySource: setup?.openrouterKeyEncrypted
      ? "settings"
      : config.OPENROUTER_API_KEY
        ? "environment"
        : null,
    r2Configured: r2Ready(),
    modelId: setup?.modelId ?? null,
    models: approvedModels.models,
  };
}
export async function saveAiSettings(input: unknown) {
  const { modelId, apiKey } = aiSettingsSchema.parse(input);
  if (modelId && !approvedModels.models.some((m) => m.id === modelId))
    throw new HttpError(400, "Choose an approved model.");
  await prisma.setup.update({
    where: { id: 1 },
    data: {
      modelId,
      ...(apiKey ? { openrouterKeyEncrypted: encryptKey(apiKey) } : {}),
    },
  });
}
export async function removeAiKey() {
  await prisma.setup.update({
    where: { id: 1 },
    data: { openrouterKeyEncrypted: null },
  });
}
export async function checkAiKey(input: unknown) {
  const { apiKey } = aiKeyCheckSchema.parse(input);
  const key = apiKey ?? (await getOpenRouterKey());
  if (!key) throw new HttpError(400, "Enter your OpenRouter API key first.");
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(
      503,
      "OpenRouter could not be reached. Try again shortly.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new HttpError(
      400,
      "OpenRouter rejected this API key. Check it and try again.",
    );
  if (!response.ok)
    throw new HttpError(503, "OpenRouter is unavailable. Try again shortly.");
  // Never expose the provider's response, which can include key/account metadata.
  await response.body?.cancel();
}
