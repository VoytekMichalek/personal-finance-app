# Agent instructions — Personal Finance

## Purpose and adopted baseline

A shared AUD household finance tracker for Voytek and his wife.

The shared policy source is the [Codename Project SOP library](https://github.com/codename-systems/codename-project-sops).
Before implementation or SOP-guided assessment, follow its [policy-loading procedure](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/sops/agent-policy-loading.md):
retrieve current `main` once using the installed helper or authenticated read-only Git, record
the exact source SHA/time and read relevant standards at that revision. Adapt this procedure link
to the canonical repository URL in generated projects. Keep the retrieved revision fixed for the task.

Read `docs/sop-adoption.md` and the relevant local files in `docs/standards/` as the adopted baseline.
This project follows Codename SOP revision `9335fad26de93124a891f6c6544bb388aa366084`, with exceptions recorded explicitly.
Surface relevant differences without silently migrating unrelated behaviour or claiming full adoption.
Explicit user directions and local guardrails remain applicable. Templates and examples are reference
material, not authorisation for unrelated actions.

## Project track

Track: private-webapp. Monorepo with `apps/web` (Vite), `apps/api` (Express/auth/Prisma), and `packages/shared` (Zod, types and pure financial calculations). The API production image includes the compiled frontend. No public website.

## Repository guardrails

- Keep changes scoped; preserve unrelated human work. Ask for direction if unexpected conflicting repository state prevents safe progress.
- Where present, backend domains live under `apps/api/src/modules/`; private frontend domains under `apps/web/src/`; public pages under `apps/site/app/`; shared schemas/types under `packages/shared/src/`.
- Maximum maintained source length is 450 lines and maintained file size is 600 KB, with explicit generated-file/asset exclusions enforced in `scripts/guardrails.mjs`.
- Keep routes thin, logic in services, validation in shared Zod and database access through Prisma.
- No catch-all legacy folders, compatibility shims or boundary-bypassing imports.
- Organise components by real feature domain. Pages orchestrate, components render, hooks own queries/mutations. Use focused public barrel exports without cycles.
- Use Tailwind utilities and the selected track’s UI libraries for their intended roles; do not duplicate their machinery. Public pages use Server Components and focused interactive client components; do not ship admin providers/dependencies in public bundles.

## Security, configuration and data

- For authenticated apps, use Better Auth passkeys and the local authentication standard. Enforce roles on the server.
- Bootstrap is one-time and durable; invitations/recovery are bound to one user and expire. Preserve last-admin protections and revoke stale access.
- Follow `docs/standards/environment-and-deployment.md` for per-service deployment examples, input ownership/phases and separate local configuration. Never log or commit secrets.
- Follow the authoritative `docs/standards/application-logging.md` for severity, expected requests/polls, investigation controls, incident distinction and redaction.
- Preserve `minimumReleaseAge: 2880`; exclusions or bypasses need explicit maintainer approval and documentation.
- Commit Prisma migration files with schema changes. Production startup applies committed migrations automatically and fails before serving if they fail.
- Never run destructive schema changes or Git commands without explicit approval. Preserve historical business records and unrelated changes.
- Compose is for local supporting services only. Production uses individual personal Dokploy Cloud services on Linode. The owner explicitly authorised automatic deployment after successful releases on 25 October 2026; preserve the release webhook and rollout verification. See `docs/hosting.md` and the adoption exception.

## Application delivery

- The first build must fully implement the requested product scope and every applicable requirement of the selected standard path, including working features, real persistence/integrations where required, tests, build/image and CI/release configuration, documentation and handover. Follow `docs/sops/project-instantiation.md`; do not stop at scaffolding, mock-only flows or placeholder UI.
- Reduce first-build scope or choose a different path only when the user specifically requests that departure. Record the actual instruction and affected requirements in `docs/sop-adoption.md`, retain other requirements and label reduced delivery honestly. “Simple”, “quick”, “initial” or “MVP” alone is not a waiver. Missing access or credentials is a blocker to record, not permission to omit work. Full site-only implementation still omits speculative backend/auth services.
- Authenticated webapps include Settings → Users (admin-only) and System (read-only Version, Release Tag, Build Commit, Build Time). Every signed-in user has a user coin, ideally near the bottom, for creating/managing passkeys and logging out. Preserve last-passkey protection and server-side session invalidation.
- Include local Codename attribution at the sidebar/mobile-navigation bottom or public footer. Authenticated apps include a Documentation sidebar item; site-only provides visitor help only where useful.
- Update repository-maintained user guides with every relevant feature change. Explain when a change has no user-guide impact.
- Public sites require primary HTML without client data fetching, metadata/canonicals, robots/sitemaps, real missing/unpublished HTTP 404s and internal link checks. Keep private/draft content inaccessible and excluded from indexing; noindex is not access control.
- Combined projects bundle the admin into the API image, route `/admin` and `/api` correctly, and invalidate public content caches after publishing/unpublishing. Keep Next.js separate from API/auth/database ownership.

## Testing and verification

- Follow `docs/testing.md`, `docs/standards/testing.md` and `docs/checklists/playwright-timing-review.md`.
- Add meaningful backend/frontend coverage for changed behaviour; test cross-cutting changes in each affected area.
- Verify the environment and logging standards through repository inspection and isolated production-build/image checks before deployment; record R17–R19 evidence without requiring registry publication or a live production deployment.
- New/modified Playwright tests use observable readiness and event waits registered before actions, not arbitrary sleeps.
- Install the browser clock before navigation/timer creation for timeout, debounce, autosave and retry tests. Use `fastForward` for suitable deadline jumps and `runFor` for repeated callbacks.
- Prove pending state before a timeout, then timeout and recovery. Use response barriers for mocked loading; negative assertions follow the relevant timer window or completion.
- Keep justified real timing for backend/database/media boundaries and explain it beside the test.
- Follow the central testing standard for risk/layer ownership, compatible setup/build reuse and parallel execution. Run independent tests concurrently; declare setup/conflicting resources, isolate mutable data and justify measured worker budgets or narrowly sequential groups. Preserve desktop/mobile surfaces, assertions, thresholds and real integration coverage. Replacing tests requires equivalent regression/failure detection evidence.
- Install only required browser engines once per CI job, with native dependencies on fresh runners. Serve an existing build for E2E rather than rebuilding it.
- Run affected timing-sensitive tests ten consecutive times with retries disabled, then the full affected suite and required checks. Record evidence. Broad legacy conversion is separate work.
- Before committing: run guardrails for every change, relevant site/API/web typechecks and tests, and every affected workspace for cross-cutting or uncertain work. Do not commit failures without explicit maintainer waiver.

## Git, CI and releases

- For a pre-deployment assessment, follow `docs/sops/ready-to-deploy.md` and reference the authoritative R01–R19 list in `docs/checklists/ready-to-deploy.md`; do not maintain another copy. The Ready to deploy / Not ready decision depends only on applicable R checks. Record candidate/evidence identity, retain every ID in order and preserve Unverified results for missing evidence. Explain each outstanding item's requirement, expected/observed behaviour, evidence, exact action and known owner directly in the summary. Reuse matching CI evidence and run only missing/stale/affected verification. Full instantiation, broad CI/acceptance, release publication, registry availability, target provisioning, backup/restore, SEO and live checks cannot add assessment gates; they retain their own policies. Recheck affected R evidence after candidate/configuration changes.
- Default to focused commits on `main` and pushes to `origin/main`, respecting task scope and repository protections. Keep main green.
- Use Conventional Commits with a scope: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`; add `!` for breaking changes.
- Approved permanent ownership exception: repository `VoytekMichalek/personal-finance-app`, registry `ghcr.io/voytekmichalek/personal-finance-app`. See adoption record.
- Permanent personal CI/release policy: GitHub Actions are owned by this repository. Do not introduce Codename CI wrappers, reusable workflows, actions or organisation credentials. Release may reuse `./.github/workflows/ci.yml`; this is repository-local reuse. Preserve frozen install, guardrails, lint, typecheck, unit/integration tests, E2E, audit, build, image smoke tests and scans. This policy supersedes shared-workflow requirements in the copied SOPs, regardless of upstream accessibility.
- Release from main only after validation and docs updates; use annotated `vMAJOR.MINOR.PATCH` tags. Never retag an existing release.
- Combined releases use one verified hybrid workflow for the site and API/admin images, one release identity and separate smoke/scan checks. No separate admin container or production Compose.
- Release CI validates before publishing, generates structured notes with links/contributors, and passes configured AI review, image smoke tests and scans. Required failures block publication.
- Release/deployment actions follow the user's authorised task; do not treat documentation as permission to publish or deploy.

## Project-specific commands and boundaries

Use Node 24.21.0 and pnpm 10.34.6. Root commands: `pnpm ci:prepare`, `pnpm ci:validate`, `pnpm ci:smoke`. Workspaces: `pnpm --filter @finance/api typecheck`, `pnpm --filter @finance/web typecheck`, `pnpm test` (shared calculations and API parser/provider tests). Database integration and E2E use isolated finance_test/finance_e2e databases only. Never reset the real finance database. AUD cents and calendar-date ledger semantics must remain exact; refunds reduce expenses and linked transfers never count as income/spending. Review AI suggestions before imports; enforce source amounts/dates on the server. Keep R2 private and credentials server-only. Publication/deployment are separately authorised actions.
