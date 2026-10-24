# SOP: Project Instantiation

This is the entry procedure for new Codename Systems applications. Document version, owner and review cycle are recorded in the [library document control](../sop-library.md#document-control).

## 1. Purpose and scope

A project is instantiated when its requested features and applicable track requirements work end to end, and another engineer or agent can clone it, configure it, run it, test it, build it and understand deployment without undocumented knowledge.

Apply this baseline to public websites, combined public/private systems, internal tools, client applications, admin dashboards, data-entry and workflow systems, reporting portals and lightweight SaaS applications. One-off scripts, experiments and disposable prototypes may use a smaller baseline only when the user explicitly requests that scope, under the rule below. Existing applications keep their adoption record; broad migration is separately scoped. New and modified Playwright tests follow the [testing standard](../standards/testing.md).

Use the company starter where available. If no suitable starter exists, use this library's [templates](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/README.md) to construct the baseline and explain the choice. Do not recreate the stack or folder structure without a project-specific reason.

### Default first build: full implementation

For a new project, agents and engineers **must default to a full build-out on one of the standard paths**: private webapp, public site-only, or combined public website and private webapp. Select the matching [track and mode](../standards/project-tracks.md#choose-the-project-type) before implementation. This rule concerns the first delivered implementation, not just a successful compile or build command. The user does not need to repeat the SOP requirements or separately ask for a full build.

A full build-out includes the requested product features working end to end, every applicable requirement of the selected path, real data persistence and integrations where required, usable UI and states, tests and passing quality gates, working build/image and CI/release configuration, maintained documentation and handover evidence. A scaffold, UI mockup, placeholder page, stubbed action or mock-only implementation does not satisfy an applicable feature. Continue through implementation and validation; do not stop at repository setup or defer required auth, data, settings, documentation or delivery work as optional follow-up.

Full means complete for the requested product scope and selected path. It does not add speculative features or services: site-only remains a complete path without an unused admin, API, database or authentication system. Release publication and production deployment retain their existing authorisation requirements.

Use a reduced first build or a different path **only when the user explicitly requests it**. The request must identify the intended limit or alternative, such as “only scaffold the repository”, “make a disposable UI prototype with mocked data”, or a named alternative stack. Words such as “simple”, “quick”, “initial” or “MVP” alone do not waive applicable baseline requirements. Do not infer an exception from a short brief, implementation effort, missing credentials or time pressure. Resolve routine choices using the standard path; ask a focused scope question only when material ambiguity prevents progress, while continuing independent work.

Record any such exception in `docs/sop-adoption.md`: the user's specific instruction, affected requirements, omissions, reason/trade-off, owner and path back to the baseline. Apply it only to the requested departure and retain the remaining requirements. If external access or another dependency blocks completion, record the blocker and unfinished work; an agent-created deferral is not a user-requested exception. A reduced deliverable may complete the user's limited task but must be labelled as reduced scope, without claiming full instantiation is complete.

## 2. Personal ownership and repository-local workflows

This section is adapted for the permanent personal ownership decision in [SOP adoption](../sop-adoption.md). This repository is `VoytekMichalek/personal-finance-app`, with images published as `ghcr.io/voytekmichalek/personal-finance-app:vMAJOR.MINOR.PATCH`. Organisation ownership and transfer requirements from the upstream template do not apply.

Maintain `.github/workflows/ci.yml`, `.github/workflows/release.yml` and their scripts in this repository. Do not call Codename CI wrappers, reusable workflows or actions, or require Codename organisation credentials. Release reuses `./.github/workflows/ci.yml` to preserve one validation definition. Pin third-party actions to immutable commits and review their permissions.

Keep runtime/package-manager pins, installation, isolated database services, validation, release notes, image smoke tests and scans explicit in these local workflows and scripts. Use the repository-scoped `GITHUB_TOKEN` for release publication. Production deployment remains manual; do not add deployment triggers.

## 3. Standard stack

First select a [project track and mode](../standards/project-tracks.md):

| Project type | Standard path |
| --- | --- |
| Private webapp | Web Application: React/Vite webapp plus Express API and PostgreSQL/Prisma |
| Public frontend website | Hybrid SEO, site-only: Next.js App Router; no speculative backend or auth |
| Public website plus private webapp | Hybrid SEO, managed admin or advanced backend: Next.js site plus Vite admin and Express API |

The following table defines the authenticated application stack, including the private part of a combined project. Public sites use the Next.js stack and rendering/SEO rules in the linked track standard. Toolchain, quality, ownership and delivery rules apply to every track; database/authentication rules apply when those capabilities are present.

| Area | Baseline |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Lucide |
| Forms and validation | React Hook Form, shared Zod schemas |
| Server state | TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL and Prisma |
| Authentication | Better Auth with passkeys and the [authentication standard](../standards/authentication.md) |
| Tests | Vitest and Playwright |
| Toolchain | mise, pnpm, committed lockfile and 48-hour package release age gate |
| Infrastructure | Docker images; Compose for local supporting services; manual Dokploy production deployment |
| Uploads | Private S3-compatible object storage when required |

Select maintained, mutually compatible versions during instantiation. Record and pin them in `mise.toml`, `package.json` (`packageManager` and `engines`), the lockfile, Dockerfile and workflow wrappers. The inherited Node 22 baseline is usable only while supported; do not treat an example version as a requirement to use an unsupported runtime. Verify the selected pnpm version supports `minimumReleaseAge`.

### Frontend architecture

For authenticated application frontends, use shadcn/ui for buttons, inputs, dialogs, dropdowns, tables, forms, cards, tabs and toasts. Use Lucide for icons and React Hook Form with Zod for forms. TanStack Query owns client-side server-state fetching, caching, loading/error states, mutations and cache invalidation; do not duplicate that machinery manually.

Organise components by actual feature domain, for example `components/projects/` or `components/clients/`. `components/common/` is for genuinely shared UI. Pages orchestrate state and navigation, components encapsulate UI/forms, and hooks encapsulate queries and mutations. Use narrow barrel exports for public feature interfaces without introducing cycles or importing private internals across boundaries.

Use Tailwind utilities for application styling. Keep framework/theme setup in the central stylesheet; do not introduce handcrafted feature selectors. Dynamic values such as user colours may use narrowly scoped CSS variables or inline styles when utilities cannot express them.

For every track, enforce a maximum of 450 lines per maintained source file and 600 KB per maintained file through `scripts/guardrails.mjs`. Exclude lockfiles and generated output explicitly; document narrowly justified asset exceptions. Extract focused modules before exceeding limits. Do not add compatibility shims, catch-all legacy folders or boundary-bypassing imports.

### Backend architecture

Where an API is present, keep routes thin, business logic in services, validation in Zod and database access through Prisma. Organise domain modules under `apps/api/src/modules/`:

```text
modules/projects/projects.routes.ts
modules/projects/projects.service.ts
modules/projects/projects.schema.ts
modules/auth/
middleware/
lib/
server.ts
```

Store deployment-specific configuration and secrets according to the [environment standard](../standards/environment-and-deployment.md); stable defaults belong in code.

All application services follow the authoritative [logging standard](../standards/application-logging.md), including its pre-deployment inspection and isolated image checks.

### Shared validation

Place shared schemas under `packages/shared/src/schemas/` and infer TypeScript types from them:

```ts
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  description: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

Use the same schema in frontend forms and backend requests. Server-side authorisation is still required; validation alone does not grant access.

### Uploads and storage

Use S3-compatible storage, such as Linode Object Storage, AWS S3 or Cloudflare R2, with MinIO available for local development. Keep uploads private by default and authorise access through the API. Never persist user uploads in the application container. Document bucket, region, endpoint, access policy, required configuration, and local/production setup. Add storage configuration only when the project uses uploads.

## 4. Project structure

Use an `apps/` and `packages/` monorepo for projects expected to grow. This is the Web Application structure; use the [site-only or combined structure](../standards/project-tracks.md) when public pages are in scope. Do not add unused workspaces:

```text
project-name/
  apps/
    web/                 # src/, public/, package.json, Vite and TypeScript config
    api/                 # src/, prisma/, package.json, TypeScript config
  packages/shared/src/   # schemas/, types/, utils/
  docs/
    sops/
    standards/
    checklists/
    user-guide/
    testing.md
    deployment.md
    sop-adoption.md
  e2e/
  scripts/
  docker/entrypoint.sh
  .github/workflows/    # ci.yml, release.yml
  compose.local.yml
  Dockerfile
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  mise.toml
  .npmrc
  .env.example
  .env.local.example   # local inputs only, when needed
  .gitignore
  README.md
  AGENTS.md
  CONTRIBUTING.md
```

For a genuinely small private application unlikely to need separate packages, `src/client`, `src/server`, `src/shared` and root `prisma/` are acceptable. Keep the same documentation, quality scripts, workflow wrappers and delivery requirements. Adjust every template path and command to match.

## 5. Required project files and tooling

- **README.md:** purpose, audience, owner, selected track/mode, architecture, setup, environment, commands, tests, builds, authentication, storage, deployment, releases, limitations and exceptions.
- **AGENTS.md:** adapt the [agent template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/AGENTS.md.tmpl), including actual feature domains, paths, scripts and risky areas. Root and nested instructions reference the canonical SOP library and [policy-loading procedure](agent-policy-loading.md); retain architecture, quality, security, migration and Git guardrails, plus the explicit adopted baseline.
- **CONTRIBUTING.md and docs/testing.md:** adopt the deterministic waiting rules and review/validation process.
- **docs/sop-adoption.md:** exact adopted revision, copied standards, exceptions, owners and planned migration work.
- **docs/sops/ and docs/checklists/:** copied applicable procedures and checklists, including ready-to-deploy, with links adapted to the generated project. Prepare `docs/ready-to-deploy.md` from the [report template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/docs/ready-to-deploy.md.tmpl); a new scaffold leaves its checks Unverified until the first-deployment assessment.
- **Environment examples:** follow the [per-deployed-service policy](../standards/environment-and-deployment.md#environment-examples-per-deployed-service) and [matching template profile](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/README.md#select-a-project-profile). One service uses root `.env.example`; combined uses `apps/site/.env.example` and `apps/api/.env.example`. Local inputs use a distinct `.env.local.example` only when needed.
- **compose.local.yml:** only when local supporting services are required. No production Compose file.
- **mise.toml:** explicit maintained Node version. Keep versions aligned across developer machines and CI.
- **.npmrc:** begin with `engine-strict=true`, `auto-install-peers=false`, `strict-peer-dependencies=false`; verify compatibility with the selected package manager.
- **pnpm-workspace.yaml:** workspace packages and `minimumReleaseAge: 2880` (48 hours).
- **pnpm-lock.yaml:** generated and committed; CI installs with `--frozen-lockfile`.
- **.github/workflows/ci.yml and release.yml:** thin wrappers, present from the beginning.
- **Dockerfiles and startup scripts:** one application Dockerfile for a private webapp, `Dockerfile.site` for site-only, or `Dockerfile.site` and `Dockerfile.api` for combined projects. Include committed migrations and automatic migration execution in every database-owning application image; never in a database-free site.

Never remove or bypass the package age gate just to obtain a newer package. `minimumReleaseAgeExclude` requires a documented reason and maintainer approval. Prefer stable, maintained dependencies. Record any approved exclusion in the README or dependency/security notes.

Ignore `.env`, `.env.*` except `.env.example` and `.env.local.example`, `node_modules`, `dist`, `.next`, `out`, `coverage`, `playwright-report` and `test-results`. Commit the applicable examples at their profile paths. Do not commit local secrets, generated reports or machine-specific configuration.

## 6. Standard commands

| Command | Contract |
| --- | --- |
| `pnpm dev` | Start enabled site/web/API development servers |
| `pnpm services:up` / `services:down` / `services:status` | When services are used, manage local supporting services without removing data |
| `pnpm guardrails` | Enforce architecture/file limits and project-specific rules |
| `pnpm lint` / `pnpm typecheck` | Static validation |
| `pnpm test` / `pnpm test:watch` | Vitest once / watch |
| `pnpm test:e2e` / `pnpm test:e2e:ui` | Playwright full suite / interactive runner |
| `pnpm build` | Build application packages once |
| `pnpm audit --audit-level high` | Dependency audit |
| `pnpm db:generate` (Prisma projects) | Generate the locked Prisma client |
| `pnpm db:migrate:dev` (Prisma projects) | Create/apply reviewed local development migrations |
| `pnpm db:migrate:deploy` (Prisma projects) | Apply committed migrations non-interactively |
| `pnpm check:seo` / `pnpm check:links` (public sites) | Validate rendered metadata, indexing, public routes and internal links |
| `pnpm ci:validate` / `pnpm ci:release` | Complete validation gates for CI/release |

Expose applicable root scripts even when package-specific commands differ. Omit unused database/service commands with a documented reason. The [template profiles](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/README.md#select-a-project-profile) select scripts and workflows per track and build once before E2E; Playwright's server command must serve that build without rebuilding or installing browsers. Targeted commands for each enabled workspace and production image must also be documented.

## 7. Instantiation procedure

1. **Select the track and mode:** private webapp, public website, or combined system using the [track decision](../standards/project-tracks.md#choose-the-project-type). Establish users, public content/SEO needs, core workflows, integrations, storage and deployment topology from the request. Record the full first-build scope and any specific user-requested departure under the [default first-build rule](#default-first-build-full-implementation); do not make full implementation an opt-in follow-up. Use the monorepo if growth or multiple maintainers are likely.
2. **Name the project:** choose a descriptive lowercase hyphenated slug, for example `client-reporting-portal`. Avoid `app`, `new-app` or `test-project`.
3. **Create the organisation repository:** use the approved starter or the templates; include required files, package structure and thin CI/release wrappers. Record the SOP revision.
4. **Set the toolchain:** align runtime and pnpm pins, enforce the age gate, install dependencies and commit the lockfile.
5. **Configure the environment:** create the selected profile's per-service deployment examples and document actual ownership/build/runtime phases under the environment standard. For local development, copy the distinct `.env.local.example` to ignored `.env` when needed, generate separate random local auth/bootstrap secrets for authenticated apps and confirm ignored files. Do not copy production credentials into development.
6. **Start required local services:** `pnpm services:up`, then `pnpm services:status`, when the project uses them. A database-free site skips this step. Confirm PostgreSQL connectivity when applicable; add Redis, MinIO or mail-testing services only when actually needed.
7. **Configure Prisma where used:** generate the client, create and commit the initial migration, apply it to a clean database, and document safe repeatable seeds if used. Wire deployment migration execution into the API/application production entrypoint. Record this step as inapplicable for database-free sites.
8. **Build the complete product and selected baseline:** implement the requested features end to end, including their UI, validation, permissions, persistence and integrations where applicable, and verify each enabled workspace and its connectivity/configuration. Authenticated apps implement Better Auth, bootstrap, invitations, roles, Settings → Users/System, a user coin for passkeys/logout and Documentation navigation. Public sites implement server-rendered content, metadata, canonicals, robots, sitemaps and correct 404s. Combined projects implement public content boundaries, publishing/revalidation and API/admin routing. Include Codename attribution on each surface. Scaffolding and mock-only flows are intermediate work unless the user specifically requested a reduced deliverable.
9. **Validate:** run guardrails, lint, typecheck, unit/integration tests, audit, build and critical E2E flows. Include the linked standards' per-service configuration and logging inspection/isolated image checks. Follow ten-run verification for new or changed timing-sensitive tests. Resolve failures rather than marking scaffolding complete with nonfunctional commands.
10. **Document:** complete README, AGENTS, contribution/testing/deployment notes and user guides. Explain authentication, storage where relevant, release procedure, limitations and exceptions.
11. **Commit and push the completed baseline:** use a focused Conventional Commit, normally `chore(project): instantiate application baseline`, on `main`; respect repository protections and the user's authorised scope. Never commit broken starter files or secrets.
12. **Verify delivery setup:** observe push CI, validate the selected single-image or two-image release wrapper and every image/readiness/migration contract, and document manual Dokploy steps. Include the [ready-to-deploy procedure](ready-to-deploy.md) for the finished project's first-deployment assessment; completing instantiation does not establish that decision. A fully implemented first build need not be tagged or deployed to complete instantiation; release/deployment actions require the relevant task authorisation.
13. **Verify handover:** another engineer must be able to clone, install, start services, configure, run, test and build from written instructions, and understand schemas, migrations and deployment. Complete the [acceptance checklist](../checklists/project-instantiation.md).

## 8. Branching, releases and validation

Default to focused direct commits on `main` and pushes to `origin/main`, unless the project requires PRs. Keep main green. Use Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, with scopes; mark breaking changes using `!`.

Before committing, run guardrails for all changes, relevant site/web/API typechecks and tests for touched areas, and every affected workspace for cross-cutting or uncertain changes. Do not commit known validation failures unless a maintainer explicitly waives and records them.

Push/PR CI must install with the frozen lockfile, run guardrails, lint, typecheck, unit/integration tests, E2E, audit and build. Document any genuinely inapplicable step. Push CI validates only and must not publish production artefacts. High/critical audit findings block unless a maintainer explicitly records accepted risk.

Release from `main` only after validation and documentation updates. Use an annotated `vMAJOR.MINOR.PATCH` tag: patch for compatible fixes/chores, minor for compatible features, major for breaking changes. Never retag; correct mistakes with a new version. Release CI runs the same validation before publishing; no gate may silently disappear.

Generate structured release notes grouped by features, fixes, chores, documentation, tests, CI, refactors and breaking changes, including commit links and contributors where practical. Build versioned GHCR images, run configured AI review, image smoke tests and vulnerability scans, and create/update the GitHub Release. A failure in an enabled gate blocks publication. Deploy the validated image manually in Dokploy using the [deployment procedure](../standards/environment-and-deployment.md#manual-production-deployment).

Before the first production deployment, complete the scoped [ready-to-deploy assessment](ready-to-deploy.md) against the candidate's applicable [R01–R19 checks](../checklists/ready-to-deploy.md). This single assessment decision verifies those capabilities/configuration only; full instantiation, release publication and operational preparation retain their separate policies and cannot be imported as blanket assessment gates. A locally built application can provide evidence without published images or a prepared production target.

## 9. Exceptions and completion

Permitted exceptions require a clear project reason, trade-off, scope, owner, temporary/permanent status and path back to the baseline. Next.js for public sites is a standard track, not an exception. Examples include a justified alternative CMS/static-site framework, NestJS for a larger backend, Python for data/AI-heavy work, another database when PostgreSQL is unsuitable, or required client SSO. Do not treat the exception mechanism as permission to bypass explicit requirements.

A reduced first build or alternative project path additionally requires the user's specific instruction under the [default first-build rule](#default-first-build-full-implementation). Documenting an agent's preference does not authorise either departure.

Instantiation is complete when the [checklist](../checklists/project-instantiation.md) has evidence, the requested product workflows work end to end, all selected workspaces run, applicable migrations/authentication and public-site requirements work, quality gates pass, CI is green, docs are useful and another engineer can take over. If a requirement is pending, mark the baseline incomplete and identify the remaining work. Distinguish a user-requested reduced deliverable from full instantiation in the handover.

Avoid undocumented structures, missing README/AGENTS/workflows, copied workflow internals, personal registry namespaces, disabled package age checks, unvalidated releases, stale docs, leaked secrets, duplicate validation logic, bloated routes, manual server-state plumbing, container-local uploads and unconfigured tests.
