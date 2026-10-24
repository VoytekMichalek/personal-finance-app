import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
dotenv.config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});
const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  FIRST_USER_TOKEN: z.string().min(32).optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
});
const parsed = schema.safeParse(
  Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      value || undefined,
    ]),
  ),
);
if (!parsed.success)
  throw new Error(
    "Invalid server configuration: " +
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
  );
export const config = parsed.data;
if (
  process.env.NODE_ENV === "production" &&
  (!config.BETTER_AUTH_URL.startsWith("https://") ||
    Object.values(config).some(
      (v) => v?.includes("replace-with") || v?.includes("local-finance-only"),
    ))
)
  throw new Error(
    "Production configuration contains an insecure origin or placeholder",
  );
export const r2Ready = () =>
  Boolean(
    config.R2_ENDPOINT &&
      config.R2_BUCKET &&
      config.R2_ACCESS_KEY_ID &&
      config.R2_SECRET_ACCESS_KEY,
  );
export const projectRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
