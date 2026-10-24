import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./config.js";
const file = path.join(projectRoot, "build-metadata.json");
export const metadata = fs.existsSync(file)
  ? (JSON.parse(fs.readFileSync(file, "utf8")) as {
      version: string;
      releaseTag: string;
      buildCommit: string;
      buildTime: string;
    })
  : {
      version: "development",
      releaseTag: "unreleased",
      buildCommit: "unknown",
      buildTime: "unknown",
    };
