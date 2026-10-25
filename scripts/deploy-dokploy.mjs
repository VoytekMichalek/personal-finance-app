/* global AbortSignal */
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const image = "ghcr.io/voytekmichalek/personal-finance-app";
const readinessUrl = "https://finance.michalek.app/ready";

export function deploymentWebhooks(value = "") {
  const webhooks = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (webhooks.length !== 1)
    throw new Error(
      "Configure DOKPLOY_DEPLOY_WEBHOOKS with the finance app's single webhook URL.",
    );
  for (const webhook of webhooks) {
    let url;
    try {
      url = new URL(webhook);
    } catch {
      /* Report without the secret URL. */
    }
    if (
      !url ||
      url.origin !== "https://app.dokploy.com" ||
      !/^\/api\/deploy\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "The deployment webhook must be an HTTPS Dokploy Cloud application webhook.",
      );
  }
  return webhooks;
}

export async function requestDeployment(webhook, tag, commit, request = fetch) {
  try {
    const response = await request(webhook, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "registry_package",
      },
      body: JSON.stringify({
        registry_package: {
          package_version: {
            package_url: image + ":latest",
            container_metadata: { tag: { name: "latest" } },
          },
        },
        head_commit: { id: commit, message: "Release " + tag },
      }),
    });
    // Dokploy also returns 301 for image/tag mismatches. Never follow redirects
    // or mistake an accepted HTTP request for a completed rollout.
    if (
      response.status !== 200 ||
      (await response.json()).message !== "Application deployed successfully"
    )
      throw new Error("Unexpected deployment response");
  } catch {
    // URLs contain bearer credentials; neither transport errors nor response
    // bodies are safe to print in public Actions logs.
    throw new Error(
      "Dokploy did not accept the deployment. Check its app source, autodeploy setting and webhook secret.",
    );
  }
}

export async function waitForRelease(
  tag,
  commit,
  { request = fetch, pause = delay, attempts = 60 } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await request(readinessUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (
        response.ok &&
        response.headers.get("x-release-tag") === tag &&
        response.headers.get("x-build-commit") === commit &&
        (await response.json()).ok === true
      )
        return;
    } catch {
      /* DNS, TLS and startup failures are bounded by the rollout wait. */
    }
    if (attempt + 1 < attempts) await pause(5000);
  }
  throw new Error(
    "The expected release did not become ready at finance.michalek.app. Inspect Dokploy deployment and application logs.",
  );
}

async function main() {
  const webhooks = deploymentWebhooks(process.env.DOKPLOY_DEPLOY_WEBHOOKS);
  if (process.argv.includes("--check")) {
    console.log("Personal Dokploy deployment configuration is present.");
    return;
  }
  const { RELEASE_TAG: tag, BUILD_COMMIT: commit } = process.env;
  if (
    !/^v\d+\.\d+\.\d+$/.test(tag ?? "") ||
    !/^[a-f0-9]{40}$/.test(commit ?? "")
  )
    throw new Error(
      "Deployment requires the immutable release tag and full commit SHA.",
    );
  for (const webhook of webhooks) await requestDeployment(webhook, tag, commit);
  console.log(
    "Dokploy accepted the rollout; waiting for the published release.",
  );
  await waitForRelease(tag, commit);
  console.log("Release " + tag + " is ready at https://finance.michalek.app.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
