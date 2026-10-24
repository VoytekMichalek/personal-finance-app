import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const result = spawnSync("pnpm", ["exec", "prisma", ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL("../apps/api", import.meta.url)),
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
