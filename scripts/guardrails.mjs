import fs from "node:fs";
import path from "node:path";
const ignored = new Set([
  ".git",
  ".agents",
  ".aws",
  ".codex",
  "node_modules",
  "dist",
  ".tools",
  "artifacts",
  "test-results",
  "playwright-report",
  "coverage",
]);
const errors = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else {
      if (entry.name === "pnpm-lock.yaml") continue;
      const size = fs.statSync(file).size;
      if (size > 600 * 1024) errors.push(file + " exceeds 600 KB");
      if (
        /\.(tsx?|m?js)$/.test(file) &&
        fs.readFileSync(file, "utf8").split("\n").length > 450
      )
        errors.push(file + " exceeds 450 lines");
    }
  }
}
scan(".");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Source and file-size guardrails passed.");
