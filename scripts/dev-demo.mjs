import { spawn } from "node:child_process";
import { demoEnvironment, PrismaClient } from "./demo-environment.mjs";
const { env, target } = demoEnvironment();
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
  "Starting the separate demo household at http://localhost:5173. Stop this and run pnpm dev to return to your regular records.",
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
