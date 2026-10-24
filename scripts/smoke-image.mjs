import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
const migrationCount = String(
  readdirSync("apps/api/prisma/migrations", { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  ).length,
);
const suffix = randomBytes(5).toString("hex");
const network = "finance-smoke-" + suffix;
const postgres = "finance-db-" + suffix;
const app = "finance-app-" + suffix;
const image = process.env.IMAGE ?? "personal-finance:verification";
const secret = randomBytes(32).toString("hex");
const dbPassword = randomBytes(24).toString("hex");
function docker(args, allowFailure = false) {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  if (r.status && !allowFailure)
    throw new Error("Docker operation failed: " + args[0] + " " + r.stderr);
  return (r.stdout + (args[0] === "logs" ? r.stderr : " ")).trim();
}
async function waitUntil(operation, seconds = 45) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await operation()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Image readiness deadline exceeded");
}
function start(name, db = "finance", overrides = []) {
  return docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    "-p",
    "127.0.0.1::3000",
    "-e",
    "DATABASE_URL=postgresql://finance:" +
      dbPassword +
      "@" +
      postgres +
      ":5432/" +
      db,
    "-e",
    "BETTER_AUTH_URL=https://finance.example.test",
    "-e",
    "BETTER_AUTH_SECRET=" + secret,
    "-e",
    "FIRST_USER_TOKEN=" + randomBytes(32).toString("hex"),
    ...overrides,
    image,
  ]);
}
function url(name) {
  const port = docker(["port", name, "3000/tcp"]).split(":").at(-1);
  return "http://127.0.0.1:" + port;
}
try {
  docker(["network", "create", network]);
  docker([
    "run",
    "-d",
    "--name",
    postgres,
    "--network",
    network,
    "-e",
    "POSTGRES_USER=finance",
    "-e",
    "POSTGRES_PASSWORD=" + dbPassword,
    "-e",
    "POSTGRES_DB=finance",
    "postgres:16.10-alpine",
  ]);
  await waitUntil(() =>
    docker(["exec", postgres, "pg_isready", "-U", "finance"], true).includes(
      "accepting connections",
    ),
  );
  start(app);
  const base = url(app);
  await waitUntil(async () => {
    try {
      return (await fetch(base + "/ready")).ok;
    } catch {
      return false;
    }
  });
  assert.equal((await fetch(base + "/api/snapshot")).status, 401);
  assert.equal((await fetch(base + "/api/missing")).status, 401);
  assert.equal((await fetch(base + "/")).status, 200);
  const frontend = await (await fetch(base + "/")).text();
  assert(frontend.includes("Personal Finance"));
  assert(!frontend.includes(secret));
  const metadata = JSON.parse(
    docker(["exec", app, "cat", "/app/build-metadata.json"]),
  );
  assert(
    metadata.version &&
      metadata.buildTime &&
      metadata.buildCommit &&
      metadata.releaseTag,
  );
  const migrations = docker([
    "exec",
    postgres,
    "psql",
    "-U",
    "finance",
    "-d",
    "finance",
    "-Atc",
    'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  ]);
  assert.equal(migrations, migrationCount);
  for (const binary of ["pdfinfo", "pdftotext", "pdftoppm", "tesseract"])
    assert(
      docker(["exec", app, "sh", "-c", "command -v " + binary]).includes(
        binary,
      ),
    );
  docker(["exec", app, "pdfinfo", "-v"]);
  assert(
    docker(["exec", app, "tesseract", "--list-langs"])
      .split("\n")
      .includes("eng"),
  );
  const user = docker(["exec", app, "id", "-u"]);
  assert.notEqual(user, "0");
  const before = docker(["logs", app]);
  for (let i = 0; i < 3; i++) await fetch(base + "/ready");
  assert.equal(docker(["logs", app]), before);
  assert(!before.includes(secret));
  assert(!before.includes(dbPassword));
  docker(["restart", app]);
  const restartedBase = url(app);
  await waitUntil(async () => {
    try {
      return (await fetch(restartedBase + "/ready")).ok;
    } catch {
      return false;
    }
  });
  assert.equal(
    docker([
      "exec",
      postgres,
      "psql",
      "-U",
      "finance",
      "-d",
      "finance",
      "-Atc",
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    ]),
    migrationCount,
  );
  docker([
    "exec",
    postgres,
    "psql",
    "-U",
    "finance",
    "-d",
    "postgres",
    "-c",
    "CREATE DATABASE broken",
  ]);
  docker([
    "exec",
    postgres,
    "psql",
    "-U",
    "finance",
    "-d",
    "broken",
    "-c",
    'CREATE TABLE "User" (id text)',
  ]);
  const broken = app + "-broken";
  start(broken, "broken");
  await waitUntil(
    () =>
      docker(["inspect", "--format", "{{.State.Running}}", broken]) === "false",
  );
  assert.notEqual(
    docker(["inspect", "--format", "{{.State.ExitCode}}", broken]),
    "0",
  );
  assert(!docker(["logs", broken]).includes(secret));
  const invalid = app + "-invalid";
  start(invalid, "finance", [
    "-e",
    "BETTER_AUTH_URL=http://insecure.example.test",
  ]);
  await waitUntil(
    () =>
      docker(["inspect", "--format", "{{.State.Running}}", invalid]) ===
      "false",
  );
  assert.notEqual(
    docker(["inspect", "--format", "{{.State.ExitCode}}", invalid]),
    "0",
  );
  console.log(
    "Production image passed: fresh/current migrations, migration failure, non-root, readiness, frontend, auth, configuration ownership, secret redaction and quiet polls.",
  );
} catch (error) {
  const logs = docker(["logs", app], true)
    .replaceAll(secret, "[redacted]")
    .replaceAll(dbPassword, "[redacted]");
  console.error(logs);
  throw error;
} finally {
  for (const name of [app, app + "-broken", app + "-invalid", postgres])
    docker(["rm", "-f", name], true);
  docker(["network", "rm", network], true);
}
