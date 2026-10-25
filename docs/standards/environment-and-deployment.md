# Environment and deployment

## Minimal application configuration

An environment variable belongs in a service's environment example only when it is a necessary secret or a value that genuinely differs by deployment. Stable timeouts, session/invite lifetimes, app labels, internal ports, feature defaults and retry counts belong in typed code configuration. Do not expose every library option as an environment variable.

Select the [project track](project-tracks.md) first. A site-only project has no database, bootstrap or authentication variables by default. Its `.env.example` may contain only comments when no deployment inputs are needed. The default authenticated application requires:

| Variable | Purpose | Owning service / phase |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, including credentials | API / runtime |
| `BETTER_AUTH_SECRET` | Independent random authentication secret | API / runtime |
| `BETTER_AUTH_URL` | Canonical externally reachable application/auth origin | API / runtime |
| `FIRST_USER_TOKEN` | Random first-user bootstrap secret; required only until setup completes | API / runtime |

Use at least 32 random bytes for each generated secret and distinct values for the two purposes. Reject placeholders in deployed environments. Load and validate server configuration at startup with useful errors that never reveal secret values. Never expose secrets through `VITE_*`, `NEXT_PUBLIC_*`, public endpoints or logs.

Use one documented local environment-loading convention for app servers, Prisma commands and test setup. Package-directory commands must still load the intended root `.env`; do not assume changing the working directory preserves automatic dotenv discovery. Production receives its configuration from Dokploy and does not require an on-disk `.env` file.

`DATABASE_URL` is the application's database configuration: do not add separate `POSTGRES_PASSWORD`, `DB_PASSWORD`, user, host or database-name variables to the application environment. PostgreSQL service provisioning may require its own password settings in Dokploy or local Compose; those are service settings, not duplicate application inputs.

Prefer one public origin and relative API paths, with a Vite proxy in development. Derive trusted origins and passkey RP ID from the canonical configuration. Add a separate API origin, pooled/direct migration URL or trusted-origin list only when the actual architecture requires it and document why. Never infer a trusted origin from unvalidated request headers.

Add S3, mail, third-party API or other secrets only for enabled features. Deployment-platform inputs and immutable build metadata are documented separately, not accumulated in `.env.example`. The container may set stable `NODE_ENV=production` and port defaults itself. Platforms that require a dynamic port may supply one explicitly.

For public sites, use a validated `SITE_URL` only when the canonical origin differs by deployment; a deliberately fixed canonical URL can live in code. In a combined project on one public origin, reuse the canonical origin where practical instead of requiring duplicate inputs. A server-only `INTERNAL_API_URL` is appropriate when the site calls the API over a private service network. A revalidation secret and site service address belong only to a project implementing authenticated revalidation; give each participant only the inputs it actually consumes. Do not give the site the API's database or authentication secrets. See the [site-only environment example](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/profiles/site-only/.env.example).

## Environment examples per deployed service

Every application service deployed separately in Dokploy **must have its own clearly identifiable environment example**. Each example must contain only inputs consumed by that service, identify its service/image, and label every input **build time**, **runtime**, or **both** according to the actual consuming code. Include conditional requirements, such as bootstrap only before setup completes. A service with no configurable inputs must have a comments-only example explaining that fact; do not invent variables to populate it.

Use the existing root and `apps/` layout:

| Profile | Deployment examples in the application repository |
| --- | --- |
| Private webapp, one API image containing compiled webapp | Root `.env.example`, identified as API/webapp |
| Site-only, one site image | Root `.env.example`, identified as site; comments-only when no inputs are needed |
| Combined, separate site and API/admin images | `apps/site/.env.example` for site; `apps/api/.env.example` for API/admin |

A separately deployed frontend/API on another explicitly selected path follows the same per-service rule using its actual workspace names. Source workspaces bundled into one deployed application service do not need extra deployment examples. PostgreSQL provisioning settings remain separate data-service configuration.

Database, authentication and bootstrap secrets **must appear only in the owning API service's example**. Keep server-only inputs out of browser bundles. Deployment-specific non-secret values consumed by both services may appear in both examples, with their respective phases documented; do not copy a whole API environment into the site. Immutable build metadata and deployment-platform settings remain documented separately.

The deployment guide must map each Dokploy service/image to its example and explain how each build-time input reaches the image build and each runtime input reaches the running service. A runtime setting in Dokploy cannot replace a value already embedded at build time. Document rebuild requirements and how builds use controlled content/upstream fixtures without production access. Do not supply API secrets during image builds.

Local development configuration must be clearly distinguished from these operator examples. When local inputs are needed, use a separately labelled root `.env.local.example` copied to **one ignored root `.env`**, and document the local loading convention and each server's consumers. Do not require separate local `.env` copies for the site and API. Keep local URLs and Compose credentials there, not as deployment defaults. Single-service projects retain just one deployment example; a configuration-free site needs no local environment file. Commit examples, ignore real environment files, and reject deployment placeholders/local credentials before deployment.

### Pre-deployment configuration verification

Verify this requirement by repository inspection and isolated application/image checks before production deployment; access to a live production deployment is not required:

1. Inventory deployed application services and trace environment reads through source, config validation, Dockerfiles/build scripts and startup commands. Compare consumed input names, ownership and phases with each example and the deployment guide. Check that fixed policies stay in code and that site examples/bundles contain no API secrets.
2. Build and start each actual production image using only its documented application inputs, disposable services and nonproduction fixture values. Exclude developer `.env` files and ambient configuration so missing inputs cannot be silently supplied by another service. Verify required-input/placeholder validation without disclosing values; account for bootstrap's conditional requirement.
3. Exercise representative behaviour for inputs at their documented phases, including rendered canonical/upstream behaviour where applicable. Confirm build-time changes require the documented rebuild and runtime configuration works at startup/request time as implemented. Inspect public output/bundles for secret leakage using safe fixture markers. Verify comments-only services build/start without invented application inputs.

Record service/example paths, input names/phases, candidate/build identity, commands and results in adoption or assessment evidence. Never record secret values. The scoped [R17/R18 checks](../checklists/ready-to-deploy.md#authoritative-checks) use this policy for minimal and per-service examples. Locally built production images or existing passing evidence for the same candidate can verify application behaviour; registry publication and actual Dokploy provisioning remain separate operational work below.

## Local services only with Compose

Keep `compose.local.yml` only when PostgreSQL or supporting services such as Redis, MinIO or a mail test server are required. Enabled site/web/API servers run on the developer machine using `pnpm dev`. A database-free site has no Compose file or service scripts. Do not include the production application deployment in this file.

Provide these root scripts:

```text
services:up      docker compose -f compose.local.yml up -d --wait
services:down    docker compose -f compose.local.yml down
services:status docker compose -f compose.local.yml ps
```

Use project-scoped named volumes, health checks and loopback-only published ports. Use explicit image versions aligned with production service majors. Local development credentials may be fixed safe-to-publish defaults in this local-only file and its matching example database URL. They must never be used in production. Normal shutdown preserves volumes; deleting local data is a separate explicit action.

Avoid global `container_name` values that collide between projects. If concurrent projects need different ports, document a local override rather than adding production environment knobs. Developers using an existing PostgreSQL instance may supply `DATABASE_URL` and skip the local service, while preserving documented version compatibility.

CI uses the isolated PostgreSQL service declared in this repository's `.github/workflows/ci.yml`. Do not start a second database or Compose stack when the job already provides it. See [Docker's Compose model](https://docs.docker.com/compose/intro/compose-application-model/) for service and volume behaviour.

## Prisma migrations are automatic on deployment

This section applies to applications using Prisma. In combined projects, only `api-admin` owns and runs migrations; the site image does not. Database-free sites omit migration scripts and tooling.

Commit schema changes and reviewed migration files together. Generate migrations in development, never on production startup. Preserve historical records for inactive users/clients and archived work. Destructive schema changes require explicit approval and a data-preservation plan.

Expose a root `db:migrate:deploy` script that invokes the locked Prisma version's noninteractive committed-migration apply command against the deployment database. For Prisma versions using the classic migration workflow this is `prisma migrate deploy`; the [Prisma command reference](https://docs.prisma.io/docs/cli/migrate/deploy) describes applying pending migrations. If a selected major changes the migration interface, adapt this script and its tests explicitly; do not substitute `db push`, `migrate dev` or a reset command.

The repository must include a startup entrypoint that runs migrations and starts the server only after success. Use the [entrypoint template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/docker/entrypoint.sh). Wire it into the Dockerfile with `ENTRYPOINT`; a note telling an operator to run migrations manually is insufficient.

The production image must contain the migration files, schema/config, generated client, locked CLI and any runtime needed by the migration command. Do not prune those dependencies accidentally or download an unpinned CLI during deployment. Database credentials are supplied at runtime, never during Docker build. Build client generation must not connect to production.

On failure, log a sanitised error and exit nonzero before accepting traffic. Readiness must remain false until migrations and server initialisation succeed. Pending migrations should apply once; a restart with no pending migrations must be safe. Keep database migration locking enabled and account for concurrent starts, lock timeouts and rolling deployment compatibility. Do not silently ignore errors or repeatedly restart through a broken migration as a recovery strategy.

Prefer additive/expand-and-contract changes so an older running instance remains compatible during rollout. Plan backups and any data migration before destructive changes. Reverting an image does not revert a database migration. Never automatically reset, reseed or erase a deployment database.

Verify the actual built image against an isolated fresh database, an existing database with pending migrations, an already current database and a deliberate migration failure. Confirm that failure prevents the server from starting and that restarting preserves data. Test concurrent deployment behaviour for multi-instance applications.

## Build metadata

This repository's Dockerfile accepts `APP_VERSION`, `RELEASE_TAG` and `BUILD_COMMIT` from its local workflows; `scripts/build-metadata.mjs` writes those values and the build time into the metadata artefact used by Settings → System and smoke checks. Validation builds use the Dockerfile's `unreleased` tag default. Do not require operators to type these values in Dokploy. An OCI label alone is insufficient if the running application cannot read the data it displays.

Dockerfiles should be multi-stage, reproducible and run the application as a non-root user. Preserve the signal behaviour of the server (`exec` in the entrypoint), include a meaningful health/readiness check and exclude secrets/local files from the build context. Keep uploads outside the container in authorised object storage.

## Repository-local CI and release

The [permanent personal CI decision](../sop-adoption.md#personal-ci-ownership--25-october-2026) supersedes the upstream shared-wrapper requirement. Maintain validation in `.github/workflows/ci.yml` and release publication in `.github/workflows/release.yml`. Release calls the local CI workflow before publishing the single API/webapp image. Do not introduce Codename CI wrappers, reusable workflows, actions or organisation credentials, even if they become accessible.

Pin third-party actions directly to immutable commits. Validation uses read-only repository permissions; only the publish job receives content/package write permissions and the repository-scoped `GITHUB_TOKEN`. No organisation token, inherited secret set or shared workflow checkout is required.

The validation command is the single owner of the repository's quality gate. The install step installs the lockfile and only required browser engines, including native dependencies on fresh runners. Do not also install browsers in `test:e2e`, global setup or web-server startup. Build once per job where the same artefact can be reused; a separate Docker packaging build or isolated job is a distinct build context and must not be removed at the expense of release verification.

Keep guardrails, lint, typecheck, unit/integration tests, E2E, audit and build in both push and release validation. Release additionally generates structured notes, runs configured AI review, smoke-tests/scans images and publishes only after enabled gates pass. Maintain the referenced validation, release-note and smoke scripts here; all workflow commands must resolve to real tools or local scripts.

Project exception approved on 25 October 2026: configure the personal Dokploy application webhook and deploy automatically only after successful release publication. See [hosting.md](../hosting.md) and [sop-adoption.md](../sop-adoption.md). This overrides the manual deployment steps below for normal releases; provisioning, persistence and recovery duties still apply. Secrets for optional AI review are added only when that gate is enabled. Workflow changes must not silently turn off an existing required review or scan to pass validation.

## Manual production deployment

Before the first deployment, complete the scoped [R01–R19 assessment](../sops/ready-to-deploy.md) and record its single decision in `docs/ready-to-deploy.md`. That decision verifies only the listed application capabilities/configuration. The release and operational policies in this standard remain independent responsibilities; publication, registry availability, target provisioning and backup/restore preparation do not become extra assessment blockers. The live checks below run afterward and do not form a second readiness stage.

For manual deployment, the operator must prepare registry access, selected complete images, service networking/ports, domain/DNS/TLS routing, required per-service inputs, persistence and readiness/start commands. Provision or explicitly verify required secrets without placeholder/local credentials; record input names and a redacted verification source, never values. Inspect platform settings or obtain explicit operator confirmation for preparation records rather than claiming unavailable platform evidence passed. Preserve the API migration entrypoint. When database/storage capabilities exist, identify persistence/access, backup owner and restore arrangements, safe initial-data/seed plans and applicable data-preservation approvals. Document startup/rollout order, deployment owner and first-deploy failure/rollback limits. These are operational deployment requirements, outside the scoped assessment decision.

| Project profile | Dokploy application services | Data services |
| --- | --- | --- |
| Private webapp | One API/webapp image | Separate PostgreSQL; storage when needed |
| Site-only | One site image | None by default |
| Combined | Site image plus API/admin image | Separate PostgreSQL; storage when needed |

1. Configure the selected services individually in Dokploy using their mapped [environment examples](#environment-examples-per-deployed-service) and documented build/runtime phases. Set up domain/TLS, routing, service networking and required inputs; include persistent database storage/backups only when a database is used. Keep service credentials in the owning service's configuration. Follow the [combined routing rules](project-tracks.md#combined-website-and-private-application) where applicable.
2. After successful release validation and publication, select the intended versioned GHCR images and record their digests. Combined deployments require a complete pair from the same release. Authenticate Dokploy to GHCR when images are private.
3. Deploy manually using each image's committed startup command. Do not override the API entrypoint with a command that skips migrations. For combined projects, make the migrated API ready before bringing up a site version that depends on it; preserve compatibility with the currently running site/API during rollout. No Compose file is used for production.
4. Verify readiness and immutable build metadata for every service. For public sites, check primary HTML, metadata, robots, sitemap and missing-content 404s. For authenticated apps, verify migration completion, System fields and sign-in/critical workflows; on a fresh installation complete bootstrap and remove its secret if desired. For combined projects, also verify admin assets/deep links, public/private boundaries and publishing/revalidation.
5. Record every deployed tag/digest and outcome. If rollout fails, investigate image/API/schema compatibility before reverting any image; a code rollback does not repair the database or guarantee compatibility with the other service. Document site cache persistence/invalidation and multi-instance behaviour where used.

The project README and deployment guide must describe its actual Dokploy service setup, registry access, ports, migration path, readiness checks, backup responsibility and rollback limitations. No extra recovery product feature is required.

Identify the deployment owner and where to inspect logs/readiness on failure, following the [application logging standard](application-logging.md). For a first deployment, document the failure plan without assuming an older working production image exists. Record the live verification outcome in the deployment record, separately from the earlier readiness evidence.
