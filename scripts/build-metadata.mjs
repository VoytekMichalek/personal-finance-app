import fs from "node:fs";
const [
  version = "development",
  releaseTag = "unreleased",
  buildCommit = "working-tree",
] = process.argv.slice(2);
if (
  !/^[a-zA-Z0-9._-]+$/.test(version) ||
  !/^[a-zA-Z0-9._-]+$/.test(releaseTag) ||
  !/^[a-zA-Z0-9._-]+$/.test(buildCommit)
)
  throw new Error("Invalid build identity");
fs.writeFileSync(
  "build-metadata.json",
  JSON.stringify(
    { version, releaseTag, buildCommit, buildTime: new Date().toISOString() },
    null,
    2,
  ) + "\n",
);
