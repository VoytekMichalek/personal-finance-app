import test from "node:test";
import assert from "node:assert/strict";
import {
  deploymentWebhooks,
  requestDeployment,
  waitForRelease,
} from "./deploy-dokploy.mjs";

const webhook = "https://app.dokploy.com/api/deploy/synthetic-secret";
const commit = "a".repeat(40);
const ready = (tag = "v0.0.1", sha = commit) => ({
  ok: true,
  headers: new Map([
    ["x-release-tag", tag],
    ["x-build-commit", sha],
  ]),
  json: async () => ({ ok: true }),
});

test("only the personal application's HTTPS webhook is accepted", () => {
  assert.deepEqual(deploymentWebhooks("\n " + webhook + "\n"), [webhook]);
  for (const value of [
    "",
    webhook + "\n" + webhook,
    "not-a-url",
    webhook.replace("https:", "http:"),
    webhook.replace("app.dokploy.com", "other.example"),
    webhook + "?secret=hidden",
    webhook.replace("https://", "https://user:secret@"),
  ]) {
    assert.throws(
      () => deploymentWebhooks(value),
      (error) => !error.message.includes("hidden"),
    );
  }
});

test("webhook names the configured latest image and records the release commit", async () => {
  await requestDeployment(webhook, "v0.0.1", commit, async (url, options) => {
    assert.equal(url, webhook);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    const body = JSON.parse(options.body);
    assert.equal(
      body.registry_package.package_version.package_url,
      "ghcr.io/voytekmichalek/personal-finance-app:latest",
    );
    assert.equal(body.head_commit.id, commit);
    return {
      status: 200,
      json: async () => ({ message: "Application deployed successfully" }),
    };
  });
});

test("redirects, rejections and network errors fail without leaking credentials", async () => {
  for (const request of [
    async () => ({ status: 301 }),
    async () => ({ status: 403 }),
    async () => ({
      status: 200,
      json: async () => ({ message: "secret-response" }),
    }),
    async () => {
      throw new Error(webhook);
    },
  ]) {
    await assert.rejects(
      requestDeployment(webhook, "v0.0.1", commit, request),
      (error) =>
        error.message.startsWith("Dokploy did not accept") &&
        !error.message.includes("secret" + "-"),
    );
  }
});

test("healthy old images do not count as a successful rollout", async () => {
  const responses = [ready("v0.0.0"), ready("v0.0.1", "b".repeat(40)), ready()];
  let polls = 0;
  await waitForRelease("v0.0.1", commit, {
    request: async () => responses[polls++],
    pause: async () => {},
    attempts: 3,
  });
  assert.equal(polls, 3);
});

test("an unavailable or stale deployment fails after the bounded wait", async () => {
  for (const request of [
    async () => ready("v0.0.0"),
    async () => {
      throw new Error("network");
    },
  ]) {
    await assert.rejects(
      waitForRelease("v0.0.1", commit, {
        request,
        pause: async () => {},
        attempts: 2,
      }),
      /expected release did not become ready/,
    );
  }
});
