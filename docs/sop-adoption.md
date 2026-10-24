# SOP adoption and exceptions

Owner: Voytek Michalek. Track: **private-webapp**, monorepo. Policy retrieved once from authenticated read-only current main on 2026-10-03 at 05:04:44.770 UTC and held fixed throughout this implementation.

Source: https://github.com/codename-systems/codename-project-sops
Revision: `9335fad26de93124a891f6c6544bb388aa366084`.

All applicable standards, SOP procedures and checklists are copied into `docs/standards`, `docs/sops` and `docs/checklists`, with document control in `docs/sop-library.md`. Relative links point to copied documents where available and otherwise to that pinned upstream revision. The approved model catalogue is bundled at `apps/api/src/integrations/openrouter-models.json`; attribution is a local Codename SVG.

The accepted full scope is the twelve household finance features in README, with AUD, Brisbane dates, shared records, reviewed AI suggestions and private R2 storage. No user-approved feature reduction. OpenRouter credentials can be supplied by an admin in Settings → AI (encrypted in the database), with optional ignored `.env` fallback; R2 credentials remain server configuration; integrations are implemented, but synthetic live checks remain pending. No public site, SEO or separate frontend production service applies.

## Approved permanent exceptions

| Departure | Reason and trade-off | Scope / owner | Path back |
| --- | --- | --- | --- |
| Personal repository `VoytekMichalek/personal-finance-app` and `ghcr.io/voytekmichalek/personal-finance-app` | User explicitly requested personal ownership; organisation access controls do not apply | Repository and registry / Voytek | Transfer repository and registry ownership if requested |
| Repository-local CI/release workflows | Codename's private reusable workflow repository cannot be called from this personal repository; user approved retaining equivalent local gates | GitHub Actions / Voytek | Adopt accessible, approved shared workflows while preserving the validation/smoke/scan contracts |

No package-age bypass, auth bypass, disabled audit, production Compose or automatic deployment exception. AI review is optional and unconfigured; required correctness/security gates stay enabled. Shared workflow revision assessed for contract reference: `3796eb299ba6447c55e667d1545115e24dfddf8f` (v1.10.0); local workflows do not claim to execute that private workflow.

## Toolchain and implementation choices

Node 24.21.0, pnpm 10.34.6, TypeScript 6.0.3, Prisma 6.19.3, React 19.3.0, Vite 8.3.1 and Better Auth 1.7.7 are exact pins with a committed lockfile. Official registry publication metadata was checked against the 48-hour cutoff on 2026-10-03; `minimumReleaseAge: 2880` remains enforced for resolution. TypeScript was kept below 6.1 for the selected ESLint compatibility range. The runtime/package pins agree across mise, manifests, image and workflows.

Passkey enrolment and session creation run inside a real database transaction with access serialization, including Better Auth callback writes. User removal preserves historical ownership; last-admin and last-passkey safeguards apply server-side. Financial dates, integer cents, refund and transfer semantics are covered by shared calculation tests and API integration tests.

The initial readiness record retains every R01–R19 item as Unverified. This implementation does not authorise a deployment-readiness assessment, registry publication or live deployment. See verification.md for actual delivery checks and remaining external evidence.

A targeted `@prisma/config>deepmerge-ts: 8.0.2` override removes [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The patch was published 2026-08-21 and meets the age gate. Prisma generation, committed migration application and production image startup are verified with the override; this is remediation, not an accepted-risk exception.

The production image uses maintained Alpine 3.24 with Node 24.21.0 and OpenSSL. Prisma is generated in that target image and verified through real migration/startup smoke checks. npm is removed from the runtime because installation happens in the build stage.

## Statement and navigation change — 10 October 2026

Current policy retrieved once at `2026-10-10T00:30:19.768Z`, source SHA `b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, using the installed read-only retrieval helper. Read policy loading, application UI, user documentation, testing, logging and deployment guidance against the adopted baseline. The new testing guidance puts full CI in GitHub and permits focused local checks; use that execution policy for this change. Existing standalone CI/release ownership exceptions remain; this task does not migrate unrelated release workflows or claim full adoption of the newer SOP.

At the user’s explicit request, attribution/card treatment and compact icon are copied from `codename-systems/douglas-chemists-reporting` at `018d2ac575486185c3e258a3a7a2304a4dbb5a96`, with animated sidebar collapse adapted to this UI and reduced-motion support. This scoped user-directed visual treatment supersedes the older attribution example.

On 10 October 2026 the user explicitly requested, “Also get rid of documentation for now.” Documentation navigation is temporarily hidden from the desktop sidebar and mobile Settings. This is a scoped exception to the Documentation navigation requirement; the maintained guide and existing documentation page remain available for restoration. No guide instructions refer to the removed links, so this navigation-only change needs no user-guide rewrite. Other documentation maintenance requirements remain applicable.
