import dotenv from "dotenv";
import { createRequire } from "node:module";
dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
export const { PrismaClient } = require("@prisma/client");
export const demoDatabase = "finance_demo";
export function demoEnvironment() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo data is local-only.");
  const source = new URL(process.env.DATABASE_URL);
  if (
    !["127.0.0.1", "localhost"].includes(source.hostname) ||
    source.pathname !== "/finance"
  )
    throw new Error(
      "Demo setup requires the regular local finance database; no remote or test database is accepted.",
    );
  const target = new URL(source);
  target.pathname = "/" + demoDatabase;
  return {
    source,
    target,
    env: {
      ...process.env,
      DATABASE_URL: target.toString(),
      VITE_DEMO_DATA: "1",
      OPENROUTER_API_KEY: "",
      R2_ENDPOINT: "",
      R2_BUCKET: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    },
  };
}
