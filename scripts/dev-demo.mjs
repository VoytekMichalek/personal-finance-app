import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { demoEnvironment, PrismaClient } from "./demo-environment.mjs";
const { env, target } = demoEnvironment();
env.NODE_ENV = "development";
env.FINANCE_DEMO_LOGIN = "1";
// Demo cookies cannot authenticate against the regular household process.
// Restarting the demo invalidates its previous sign-ins.
env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
const db = new PrismaClient({
  datasources: { db: { url: target.toString() } },
});
try {
  if (!(await db.account.count()))
    throw new Error("Run pnpm demo:prepare before starting the demo.");
} finally {
  await db.$disconnect();
}
console.log(
  `Starting the separate demo household at ${env.BETTER_AUTH_URL}. Use Continue as demo admin to preview without a passkey. Stop this and run pnpm dev to return to your regular records.`,
);
const child = spawn(process.execPath, ["scripts/dev.mjs"], {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
