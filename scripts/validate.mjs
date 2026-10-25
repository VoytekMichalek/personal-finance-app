import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const gates = [
  ["guardrails"],
  ["lint"],
  ["typecheck"],
  ["test"],
  ["test:release"],
  ["test:integration"],
  ["audit", "--audit-level=high"],
  ["build"],
  [
    "exec",
    "node",
    "scripts/build-metadata.mjs",
    JSON.parse(readFileSync("package.json", "utf8")).version,
    process.env.RELEASE_TAG ?? "unreleased",
    process.env.GITHUB_SHA ?? "working-tree",
  ],
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
