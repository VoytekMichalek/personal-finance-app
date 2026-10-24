import { spawn } from "node:child_process";
import fs from "node:fs";
import { testEnvironment } from "./test-environment.mjs";
const env = await testEnvironment("finance_e2e");
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/e2e-environment.json",
  JSON.stringify({
    DATABASE_URL: env.DATABASE_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    FIRST_USER_TOKEN: env.FIRST_USER_TOKEN,
  }),
  { mode: 0o600 },
);
const server = spawn(process.execPath, ["apps/api/dist/server.js"], {
  stdio: "inherit",
  env,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 1));
