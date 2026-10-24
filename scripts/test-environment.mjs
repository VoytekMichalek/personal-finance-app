import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");
export async function testEnvironment(name = "finance_test") {
  if (!/^(finance_(test|e2e)|app_test)$/.test(name))
    throw new Error("Unsafe test database name");
  const source = new URL(
    process.env.DATABASE_URL ??
      "postgresql://finance:local-finance-only@127.0.0.1:55432/finance",
  );
  if (!["localhost", "127.0.0.1", "postgres"].includes(source.hostname))
    throw new Error("Test database must be local or the isolated CI service.");
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  });
  const existing = await admin.$queryRawUnsafe(
    "SELECT datname FROM pg_database WHERE datname=$1",
    name,
  );
  if (!existing.length)
    await admin.$executeRawUnsafe('CREATE DATABASE "' + name + '"');
  await admin.$disconnect();
  source.pathname = "/" + name;
  const env = {
    ...process.env,
    DATABASE_URL: source.toString(),
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    FIRST_USER_TOKEN: randomBytes(32).toString("hex"),
    OPENROUTER_API_KEY: "",
    R2_ENDPOINT: "",
    R2_BUCKET: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    NODE_ENV: "test",
  };
  const migration = spawnSync("pnpm", ["db:migrate:deploy"], {
    stdio: "inherit",
    env,
  });
  if (migration.status) throw new Error("Test migration failed");
  return env;
}
