import { spawnSync } from "node:child_process";
import { testEnvironment } from "./test-environment.mjs";
const env = await testEnvironment(process.env.CI ? "app_test" : "finance_test");
const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
