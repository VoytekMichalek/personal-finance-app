# Personal hosting and releases

Owner: Voytek Michalek. The frontend and API run in one container on the personal
Linode `personal-apps-01`, managed by Dokploy Cloud. PostgreSQL is a separate
Dokploy service. Builds run in GitHub Actions, not on the 1 GB Linode. Other
personal projects can have separate Dokploy projects on this server.

## Release flow

1. Commit the version in the root and workspace manifests, push main, and wait
   for complete passing Validate CI on that exact commit.
2. Create an annotated `vMAJOR.MINOR.PATCH` tag on that commit and push it. Never
   move or reuse an existing tag. The first requested release is `v0.0.1`.
3. Release reuses this repository's validation workflow, checks tag/main/version
   identity, then builds, smoke-tests and scans the production image. Required
   failures block publication. All external actions remain SHA-pinned.
4. Publish `ghcr.io/voytekmichalek/personal-finance-app:vMAJOR.MINOR.PATCH`, create
   structured GitHub Release notes, and promote the same image to `latest`.
5. Call the finance application's webhook, then wait for `/ready` to return the
   exact release tag and full commit in its headers. The workflow fails if
   Dokploy rejects the request or the expected image does not become ready.

Only the release workflow deploys. A normal commit to main runs checks without
promoting an image. Release concurrency serializes publication and rollout.
The image digest is recorded in the publication job summary. The version tag
remains available for recovery even though `latest` advances on later releases.

GitHub's repository `GITHUB_TOKEN` publishes the image and release. The one
additional Actions secret, `DOKPLOY_DEPLOY_WEBHOOKS`, holds the personal finance
application's HTTPS webhook copied from its Deployments tab. It grants deployment
of that application, not general Dokploy account administration. Do not attach it
as a repository push webhook, commit it, print it, or use Codename credentials.

## Dokploy configuration

Project `Personal Finance`, environment `production`, server `personal-apps-01`:

| Service | Source / settings |
| --- | --- |
| `finance-app` | Docker provider; `ghcr.io/voytekmichalek/personal-finance-app:latest`; autodeploy enabled; internal port 3000; image entrypoint/healthcheck retained |
| `finance-db` | `postgres:16.15-alpine3.24`; private port 5432; persistent volume at `/var/lib/postgresql/data`; no published database port |

If GHCR is private, configure a personal registry credential with `read:packages`
only for pulling, scoped to the personal owner. The publishing Actions token must
not be copied into Dokploy. Package visibility and registry access must be verified
before the first rollout; a public repository does not prove a public package.

The root [.env.example](../.env.example) is the deployment example for the single
API/webapp service. All its inputs are runtime values entered in Dokploy's
Environment tab. `DATABASE_URL` uses the database service's internal hostname,
not the Linode public address. `BETTER_AUTH_URL` is
`https://finance.michalek.app`. Generate independent random 32-byte values for
`BETTER_AUTH_SECRET` and `FIRST_USER_TOKEN`. The owner selected database name,
user and password `db`; keep that service internal. Do not change it implicitly.

Keep the authentication secret backed up: it also protects stored AI credentials.
Passkeys depend on the canonical hostname. Complete first-admin registration at
that origin; bootstrap cannot reopen once completed. The bootstrap token may then
be removed. Optional AI credentials can be entered later in Settings → AI.
R2 receipt storage requires all four R2 inputs from the example, with a private
production bucket and bucket-scoped object read/write credentials.

Build identity comes from CI's `APP_VERSION`, `RELEASE_TAG` and `BUILD_COMMIT`
Docker build arguments and the generated build timestamp. These are not runtime
environment inputs. No database/auth/storage credentials enter the image build.
Local development continues to use one ignored root `.env` populated from
`.env.local.example`; it is excluded from the Docker build context.

Create a Cloudflare DNS-only A record `finance` → `172.105.168.93`. In Dokploy,
route `finance.michalek.app` to container port 3000 with HTTPS/Let's Encrypt.
Linode accepts inbound TCP 80/443 and SSH 22; the database has no Internet port.
No production Compose file is used.

## Startup, recovery and backups

Start PostgreSQL before the app. The image automatically applies committed Prisma
migrations, then starts serving. Migration failure exits before readiness; do not
replace the entrypoint or run `db push`, resets or development migrations there.

If publication fails, production is not triggered. If rollout fails, inspect the
Release Actions job and Dokploy's deployment/application logs. A successful webhook
response only starts the work; the final readiness check confirms the image that
is serving. Retry only the failed deployment job after fixing configuration.
For a later rollback, select a previous immutable image tag in Dokploy and deploy
it only after checking schema compatibility. Restore `latest` selection before
resuming automatic releases. Reverting an image does not undo migrations. The
first deployment has no previous working production image to fall back to.

Voytek owns database backup and restore. Configure scheduled Dokploy PostgreSQL
backups to a separate private R2 bucket and test a restore into a disposable
database before relying on it. Preserve the database volume when recreating app
containers. Original statement PDFs live in PostgreSQL; receipt objects live in
R2 and require their own retention/backup strategy. Keep database backups and the
authentication secret available outside this Linode. Record actual backup and
restore results separately; these instructions are not evidence that backups ran.
