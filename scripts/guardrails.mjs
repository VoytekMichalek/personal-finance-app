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
const releases = JSON.parse(fs.readFileSync("docs/releases.json", "utf8"));
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
if (releases[0]?.version !== version)
  errors.push(
    "Add the current version to docs/releases.json before releasing.",
  );
if (
  new Set(releases.map((release) => release.version)).size !== releases.length
)
  errors.push("Release history contains duplicate versions.");
for (const release of releases) {
  if (
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(release.date) ||
    !release.highlights?.length ||
    release.highlights.some((text) => typeof text !== "string" || !text.trim())
  )
    errors.push(
      "Every release needs a version, date and user-facing highlights.",
    );
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Source and file-size guardrails passed.");
