import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
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
function sql(query) {
  return docker([
    "exec",
    postgres,
    "psql",
    "-U",
    "finance",
    "-d",
    "finance",
    "-Atc",
    query,
  ]);
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
  const readiness = await fetch(base + "/ready");
  assert.equal(readiness.headers.get("x-release-tag"), metadata.releaseTag);
  assert.equal(readiness.headers.get("x-build-commit"), metadata.buildCommit);
  assert.equal(readiness.headers.get("cache-control"), "no-store");
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
  const memberId = randomUUID();
  const sessionToken = randomBytes(32).toString("hex");
  sql(`INSERT INTO "User" (id,name,email,role,state,"updatedAt") VALUES ('${memberId}','Smoke member','smoke@example.test','member','active',NOW());
    INSERT INTO "Session" (id,token,"userId","expiresAt","updatedAt") VALUES ('${randomUUID()}','${sessionToken}','${memberId}',NOW()+INTERVAL '1 hour',NOW());
    INSERT INTO "Account" (id,name,type,"openingDate","openingBalanceCents") VALUES ('${randomUUID()}','Persisted smoke account','bank','2026-10-01',12345);
    UPDATE "Setup" SET "completedAt"=NOW() WHERE id=1;`);
  const cookie = docker([
    "exec",
    "-w",
    "/app/apps/api",
    app,
    "node",
    "--input-type=module",
    "-e",
    `import { makeSignature } from 'better-auth/crypto'; console.log('__Secure-better-auth.session_token='+encodeURIComponent('${sessionToken}.'+await makeSignature('${sessionToken}',process.env.BETTER_AUTH_SECRET)));`,
  ]);
  async function deniedRequests(address) {
    assert.equal(
      (
        await fetch(address + "/api/snapshot?token=PRIVATE_QUERY", {
          headers: { Authorization: "Bearer PRIVATE_HEADER" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(address + "/api/access/users", {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(address + "/api/accounts", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://finance.example.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ secret: "PRIVATE_BODY" }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(address + "/api/PRIVATE_PATH", {
          headers: { Cookie: cookie, "User-Agent": "PRIVATE_BOT" },
        })
      ).status,
      404,
    );
  }
  await deniedRequests(base);
  assert.equal(docker(["logs", app]), before);
  docker(["kill", "--signal=USR2", app]);
  await waitUntil(() => docker(["logs", app]).includes('"enabled":true'));
  await deniedRequests(base);
  const diagnostics = docker(["logs", app]);
  assert(diagnostics.includes('"event":"request_completed"'));
  assert(!diagnostics.includes("PRIVATE_"));
  assert(!diagnostics.includes(cookie));
  assert(!diagnostics.includes(sessionToken));
  for (const route of ["/health", "/ready", "/ready"])
    await fetch(base + route);
  assert.equal(docker(["logs", app]), diagnostics);
  docker(["kill", "--signal=USR2", app]);
  await waitUntil(() => docker(["logs", app]).includes('"enabled":false'));
  const quiet = docker(["logs", app]);
  await deniedRequests(base);
  assert.equal(docker(["logs", app]), quiet);
  // Deliberately break a table only inside this disposable smoke database.
  sql('ALTER TABLE "Account" RENAME TO "Account_unavailable"');
  try {
    const failed = await fetch(base + "/api/snapshot?secret=PRIVATE_FAULT", {
      headers: { Cookie: cookie },
    });
    assert.equal(failed.status, 500);
    assert(
      !JSON.stringify(await failed.json()).includes("Account_unavailable"),
    );
    const failureLog = docker(["logs", app]);
    assert(failureLog.includes('"event":"request_failed"'));
    assert(!failureLog.includes("PRIVATE_"));
    assert(!failureLog.includes(secret));
    assert(!failureLog.includes(dbPassword));
  } finally {
    sql('ALTER TABLE "Account_unavailable" RENAME TO "Account"');
  }
  docker(["rm", "-f", app]);
  start(app, "finance", ["-e", "FIRST_USER_TOKEN="]);
  const restartedBase = url(app);
  await waitUntil(async () => {
    try {
      return (await fetch(restartedBase + "/ready")).ok;
    } catch {
      return false;
    }
  });
  assert.equal(
    (await (await fetch(restartedBase + "/api/access/status")).json())
      .bootstrapAvailable,
    false,
  );
  assert.equal(
    sql(
      'SELECT "openingBalanceCents" FROM "Account" WHERE name=\'Persisted smoke account\'',
    ),
    "12345",
  );
  sql('DELETE FROM "Session"; DELETE FROM "User";');
  docker(["restart", app]);
  await waitUntil(async () => {
    try {
      return (await fetch(url(app) + "/ready")).ok;
    } catch {
      return false;
    }
  });
  assert.equal(
    (await (await fetch(url(app) + "/api/access/status")).json())
      .bootstrapAvailable,
    false,
  );
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
    "Production image passed: migrations, preserved data, durable bootstrap without token, non-root, readiness, frontend, auth, quiet defaults, optional safe diagnostics and redacted unexpected failures.",
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
