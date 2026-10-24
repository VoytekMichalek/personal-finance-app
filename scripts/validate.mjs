import { spawnSync } from "node:child_process";
const gates = [
  ["guardrails"],
  ["lint"],
  ["typecheck"],
  ["test"],
  ["test:integration"],
  ["audit", "--audit-level=high"],
  ["build"],
  [
    "exec",
    "playwright",
    "test",
    "--grep",
    "@timing",
    "--repeat-each=10",
    "--retries=0",
  ],
  ["test:e2e"],
];
for (const args of gates) {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status) process.exit(result.status ?? 1);
}
