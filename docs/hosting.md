# Personal hosting and releases

Owner: Voytek Michalek. The frontend and API run in one container on the personal
Linode `personal-apps-01`, managed by Dokploy Cloud. PostgreSQL is a separate
Dokploy service. Builds run in GitHub Actions, not on the 1 GB Linode. Other
personal projects can have separate Dokploy projects on this server.

## Verified v0.0.2 rollout — 25 October 2026

[v0.0.2](https://github.com/VoytekMichalek/personal-finance-app/releases/tag/v0.0.2)
introduces the Michalek Finance name and Blue Dollar favicon. Release commit
`2a6024ba33e4b84757194bb1b46e55ca05aaed0c` passed the complete
[Validate run 40178038924](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40178038924)
before its annotated tag was pushed. The complete
[Release run 40178724145](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40178724145)
also passed validation, publication and automatic Dokploy deployment.

The version image and promoted `latest` share digest
`sha256:9809b99136d1bf3152a6fb39e280f4156f68409c29c253f087e2acd70278b5ca`.
At 09:11 UTC, trusted HTTPS `/ready` returned HTTP 200, `{"ok":true}`, the exact
commit above and `x-release-tag: v0.0.2`. The public HTML had the new app title
and favicon link; `/favicon.svg` returned the exact committed SVG with the correct
content type. Completed first-admin setup remained closed. No database migration,
auth origin, credential-encryption context or infrastructure identity changed.
The previously assessed moderate dependency advisory below remains a follow-up.

## Verified first release — 25 October 2026

Production is live at [finance.michalek.app](https://finance.michalek.app).
[v0.0.1](https://github.com/VoytekMichalek/personal-finance-app/releases/tag/v0.0.1)
was published from `845cb7e75ee71a71e4af96eabf5bf47761bfadfe` after the complete
[Validate run 40172824479](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40172824479)
passed. The [Release run 40173441861](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40173441861)
then passed validation, image smoke/scan, publication and automatic deployment.
The `v0.0.1` and initial `latest` images share digest
`sha256:1fd9402f540a018bf89febbfb81e4d9a8d04fb392fbd5764537db5ea1570e8b5`.

Dokploy authenticated to GHCR and completed the release webhook deployment.
Trusted HTTPS `/ready` returned HTTP 200 with `{"ok":true}`,
`x-release-tag: v0.0.1` and the exact commit above, confirmed again at 07:57 UTC. The owner
confirmed signing in; `/api/access/status` reported `bootstrapAvailable: false`
and the first-admin button disappeared. The bootstrap token remains configured
but cannot reopen completed setup. Do not rotate the authentication secret.

Inside the running production container,
`node /app/apps/api/dist/integrations/verify.js` passed a private R2 synthetic
put/get/delete round trip. OpenRouter was not configured, so the combined command
returned its documented missing-integration exit code; no AI verification pass
is claimed. AI can be enabled later through Settings → AI.

Dokploy still displayed a seven-day trial and requested a payment method at
handover. Billing completion belongs to the owner; no payment was submitted.

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
The configured receipt bucket is `personal-finance-app-prod` (Standard storage,
Automatic location, public access disabled). Its account endpoint is
`https://f6682e2cf584efd6be8cc169fa84cc7b.r2.cloudflarestorage.com`.
The app credential is scoped to object read/write in that bucket only.

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

Voytek owns database backup and restore. Dokploy now has an enabled daily
PostgreSQL backup (`0 17 * * *`, scheduler timezone not yet independently verified),
database `db`, prefix `finance-db`, keeping the latest 14 archives. Destination
`personal-finance-backups` uses the separate private R2 bucket
`personal-finance-app-backups`, region `auto`, and its own bucket-scoped
object read/write credential. The initial pre-migration backup completed on
25 October 2026 at 07:08 UTC and its `.sql.gz` archive was visible in R2 under
`finance-app-mplmq4/finance-db/`.

The post-migration archive
`finance-app-mplmq4/finance-db/2026-10-25T07-50-45-226Z.sql.gz` (6.89 kB)
was downloaded from that private bucket and restored successfully into a fresh
PostgreSQL 16 container. The check used no network, no published ports and a
temporary in-memory database volume. All five completed Prisma migrations, one
setup record and 13 categories were restored. The temporary container was removed;
production was not modified. This archive predates the owner's first-admin
completion, so it does not establish that the owner's passkey was backed up.
A further manual backup after confirmed first-admin completion finished with
Dokploy status **Done** in two seconds. That later archive was not separately
restored; the isolated restore evidence above applies to the named earlier archive.

For a recovery, first download the selected archive from the private backup bucket
and restore it into a separate PostgreSQL 16 service using `psql` with
`ON_ERROR_STOP=1` for the decompressed SQL. Verify migration history and expected
records before arranging a controlled application cutover. Preserve the original
volume and take a current backup before changing production. Retain the same
canonical auth hostname and authentication secret. A database archive does not
contain R2 receipt objects.

Preserve the database volume `finance-app-mplmq4-data` when recreating app
containers. Original statement PDFs live in PostgreSQL; receipt objects live in
R2 and require their own retention/backup strategy. Keep database backups and the
authentication secret available outside this Linode. Record actual backup and
restore results separately; these instructions are not evidence that backups ran.

## Dependency follow-up

Release gates passed, including HIGH/CRITICAL image scanning. The dependency audit
still reports one moderate advisory,
[GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), in
`express-rate-limit`'s indirect `ip-address@10.7.2` dependency. The inspected
`ipKeyGenerator` calls Node's `isIPv6` before `Address6`; the advisory's malformed
input was rejected by that validation. This is a scoped call-path assessment,
not a claim of an advisory-free dependency tree. Update to a compatible patched
version (10.7.4 or later), preserve the 48-hour dependency age policy and rerun
affected checks in a future release. No audit suppression was introduced and
v0.0.1 must not be retagged.

The 28 October v0.0.4 candidate audit passes the HIGH/CRITICAL dependency gate
and reports two moderate advisories: the existing `ip-address` item above, plus
[`qs` GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).
No dependency was changed or advisory suppressed in this feature release; the new
moderate item remains an upgrade/call-path assessment follow-up. Image scans remain
separate required release gates.

## Troubleshooting logs

Normal requests, authentication denials and health polls are quiet. Unexpected
failures emit a structured error event with a safe error type. For temporary
request diagnostics, identify this app's current container in Dokploy and run
`docker kill --signal=USR2 <finance-app-container>` on the server. This toggles
diagnostics without restarting the app; the `diagnostics_changed` event confirms
the new state. Send the same signal again to disable them. Every restart defaults
to disabled.

Diagnostic events contain a generated request ID, HTTP method, registered route
pattern, status and duration. They never include raw paths, query strings, bodies,
headers, cookies or credential values. Health/readiness requests remain omitted.
This mode is for active investigation; it is not a new configuration requirement.
