import { randomUUID } from "node:crypto";
import { r2Ready } from "../lib/config.js";
import { prisma } from "../lib/db.js";
import { suggest } from "./openrouter.js";
import { storage } from "./storage.js";
import { getOpenRouterKey } from "../modules/integrations/credentials.js";
let missing = false;
if (!(await getOpenRouterKey())) {
  console.info("OpenRouter: not configured");
  missing = true;
} else {
  const modelId = (await prisma.setup.findUnique({ where: { id: 1 } }))
    ?.modelId;
  if (!modelId) {
    console.info("OpenRouter: choose an approved model in Settings → AI");
    missing = true;
  } else {
    await suggest(modelId, {
      headers: ["Date", "Description", "Amount"],
      sample: [
        {
          Date: "01/10/2026",
          Description: "Synthetic grocery shop",
          Amount: "-1.00",
        },
      ],
      categories: [],
      rows: [],
    });
    console.info("OpenRouter: synthetic structured-response check passed");
  }
}
if (!r2Ready()) {
  console.info("R2: not configured");
  missing = true;
} else {
  const key = "verification/" + randomUUID();
  const value = Buffer.from("Synthetic storage verification");
  try {
    await storage.put(key, value, "text/plain");
    const result = await storage.get(key);
    if (
      Buffer.from(await result.Body!.transformToByteArray()).toString() !==
      value.toString()
    )
      throw new Error("Storage round trip failed");
    console.info("R2: private synthetic round trip passed");
  } finally {
    await storage.remove(key);
  }
}
await prisma.$disconnect();
if (missing) process.exitCode = 2;
