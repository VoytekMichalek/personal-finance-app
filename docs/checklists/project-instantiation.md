# Project instantiation acceptance checklist

Record evidence in the consuming project's `docs/sop-adoption.md` or handover record. A checkbox without implementation or validation is not evidence. Select the project profile first. Mark inapplicable sections with a reason (for example, no auth/database for site-only); never mark missing applicable work complete.

## Scope, ownership and structure

- [ ] Purpose, users, owner, project name and scope are documented.
- [ ] Private webapp, public website or combined type is selected; track/mode and rationale are recorded.
- [ ] The first build delivers the full requested product scope and applicable selected-path requirements by default; any reduced scope or different path records the user's specific instruction and exact departures in `docs/sop-adoption.md`.
- [ ] Requested features work end to end with real persistence/integrations where required; scaffolding, placeholders and mock-only flows do not stand in for completed features.
- [ ] Enabled workspaces and production image topology match the track; site-only has no speculative admin/API/database.
- [ ] Repository and GHCR namespace are under `codename-systems`.
- [ ] Approved starter or justified template-based setup is recorded.
- [ ] Monorepo structure is used for growing applications; any simplified structure is justified.
- [ ] Exact SOP revision and exceptions are recorded, with applicable standards copied locally.
- [ ] Root/nested AGENTS instructions reference the canonical SOP library, explain current policy retrieval and distinguish it from the adopted baseline.
- [ ] Required files, real commands and focused feature modules exist.

## Stack and tooling

- [ ] Authenticated frontends use React/Vite/TypeScript, Tailwind, shadcn/ui and Lucide; public sites use Next.js App Router/TypeScript/Tailwind.
- [ ] React Hook Form, Zod and TanStack Query are used for their applicable responsibilities; public routes do not inherit admin dependencies/providers.
- [ ] Where an API is required, Express, PostgreSQL and Prisma are configured; shared schemas avoid duplicated validation.
- [ ] mise/runtime, package manager, Dockerfile and workflow pins are compatible and aligned.
- [ ] Lockfile is committed; workspace configuration and `.npmrc` are present.
- [ ] `minimumReleaseAge: 2880` is enforced; exclusions have explicit approval.
- [ ] Source/file size guardrails and architectural boundaries are enforced.

## Public website requirements (site-only and combined)

- [ ] Public primary content is present in server HTML; client interactivity is kept focused.
- [ ] Indexable routes have metadata, canonicals, social metadata and stable slugs.
- [ ] Missing/unpublished records return real HTTP 404s from the production build.
- [ ] Robots and sitemap reflect published canonical content and exclude private/admin/API/preview routes.
- [ ] Private/draft content cannot be fetched anonymously; previews/staging have appropriate access/indexing controls.
- [ ] Structured data where useful, image accessibility/dimensions and public bundle boundaries are checked.
- [ ] Content sources, rendering/cache behaviour and publication/unpublication updates are documented and tested.
- [ ] `check:seo` and `check:links` select implemented checks included in full validation.
- [ ] Public footer has local Codename attribution; any visitor guides match actual public workflows.

## Combined topology (managed admin and advanced backend)

- [ ] `apps/site`, `apps/web` and `apps/api` have clear ownership; the API alone owns auth/business mutations/Prisma.
- [ ] `Dockerfile.site` and `Dockerfile.api` produce site and API/admin images; no separate admin container.
- [ ] `/admin` bases/assets/deep links and `/api` routes work through the router; API errors do not fall back to SPA HTML.
- [ ] Public/site and API/admin routing, origins/cookies/WebAuthn scope and the protected revalidation route are documented.
- [ ] Publishing/unpublishing updates affected public content, metadata and sitemap; revalidation is authorised and failure is visible/retryable.
- [ ] One hybrid release workflow validates/scans/smoke-tests both images, recording a matched tag/commit and both digests.
- [ ] Manual Dokploy service setup, complete-pair deployment and compatible API/migration/site rollout are documented.

## Configuration, services and data

- [ ] The [service environment policy](../standards/environment-and-deployment.md#environment-examples-per-deployed-service) is verified by source/build/startup inspection and isolated image checks: one deployment example per separately deployed application service, actual consumers and build/runtime phases, minimal inputs, API secret ownership and comments-only examples where no inputs are needed.
- [ ] Deployment docs map services/images to their examples; local `.env.local.example`/loading is distinct from operator configuration. Real `.env` files and reports are ignored; examples are committed.
- [ ] Where a database is used, `DATABASE_URL` is the single application database credential/configuration input.
- [ ] Where local services are used, local-only Compose starts them, binds to loopback and preserves data on normal shutdown.
- [ ] No production Compose file or automatic Dokploy deploy trigger exists.
- [ ] Where Prisma is used, client generation and committed initial migrations work on a clean database.
- [ ] Database-owning API image includes migration tooling/files and runs them automatically before accepting traffic.
- [ ] Migration failure blocks startup; current-schema restart and pending migration upgrade are verified.
- [ ] Destructive changes have approval, preservation and rollout plans; seeds are safe and repeatable.
- [ ] Uploads, if used, are private authorised S3 objects with documented local/production setup.

## Authentication and private application baseline (webapp and combined)

- [ ] Better Auth and passkey plugin own credentials and sessions; protected routes enforce permissions.
- [ ] First-user form accepts name/email/token and registers the first admin's passkey.
- [ ] Bootstrap is one-time, durable, race-safe and recoverable after a cancelled registration.
- [ ] Completed setup never reopens on redeployment, token changes or user deletion.
- [ ] Settings → Users provides add-user, role changes, copyable invitations, re-invite, lost-passkey reset and deletion.
- [ ] Invitations expire, consume once and invalidate prior grants when replaced.
- [ ] Access reset/deletion revokes credentials and sessions; role changes take effect promptly.
- [ ] Last-admin and historical-record protections are enforced on the server, including races.
- [ ] Every signed-in user has a user coin, ideally near the navigation bottom, with passkey creation/management and logout.
- [ ] Credential ownership and last-passkey protection are enforced; logout invalidates the current server session and protected access.
- [ ] Settings → System shows Version, Release Tag, Build Commit and Build Time from the built artefact.
- [ ] Codename attribution uses the bundled brand asset and is accessible at the sidebar/mobile-navigation bottom.
- [ ] Documentation navigation opens maintained user guides for implemented features.

## Tests and validation

- [ ] Vitest covers meaningful units/components, public metadata/content helpers and API/database integration where applicable.
- [ ] Playwright covers each enabled public/private surface, critical flows and cross-service integration where applicable.
- [ ] The [application logging standard](../standards/application-logging.md#pre-deployment-verification) has repository inspection and isolated production-image evidence for quiet expected requests/polls, meaningful warnings/errors, optional diagnostics and redaction; applicable incident detection remains distinct from routine denials. No live production deployment is needed for these checks.
- [ ] Desktop/mobile projects, required engines, capacity-based worker budgets and justified sequential groups are defined.
- [ ] Critical risks have primary/complementary test layers; setup/build reuse and concurrency follow the [efficiency checklist](testing-efficiency-review.md).
- [ ] Timing-sensitive tests satisfy the [timing checklist](playwright-timing-review.md), including ten consecutive no-retry runs.
- [ ] Browser installation/build ownership avoids duplicates within a job.
- [ ] Guardrails, lint, typecheck, tests, audit, build and full E2E pass.

## CI, release and handover

- [ ] Thin CI/release wrappers call a verified approved shared workflow revision.
- [ ] Push/PR CI validates without publishing; observed initial push CI is green when a push is in scope.
- [ ] Release validation retains all required gates before publishing versioned GHCR images.
- [ ] Release notes, configured AI review, smoke tests and scans have real commands and required secrets.
- [ ] Annotated semantic tags, Conventional Commits, main-branch releases and no-retag policy are documented.
- [ ] Every image embeds immutable metadata and has verified startup/readiness; applicable migration behaviour is documented and verified.
- [ ] Manual Dokploy setup/deployment, registry access, backups and rollback limitations are documented.
- [ ] README, AGENTS, CONTRIBUTING, testing/deployment notes and user guides match the project.
- [ ] The scoped [ready-to-deploy procedure](../sops/ready-to-deploy.md), authoritative R01–R19 checklist and report template are available for pre-deployment assessment. Its result depends only on those checks; this broader instantiation checklist remains a separate completion contract. A scaffold cannot claim unverified R capabilities passed.
- [ ] First meaningful commit/push is completed where authorised; no secrets, broken scaffolding or machine-specific files are included.
- [ ] Another engineer can clone, install, configure, run, test and build without verbal instructions.
- [ ] Handover identifies any blockers and unfinished requirements; a user-requested reduced deliverable is labelled as such and is not claimed as full instantiation.
