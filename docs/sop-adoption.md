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
| Repository-local CI/release workflows | User explicitly requires this personal repository to remain independent of Codename CI wrappers, reusable workflows, actions and organisation credentials; retain local validation/smoke/scan gates | GitHub Actions / Voytek | No migration to Codename CI is planned; changing this decision requires an explicit owner instruction |

No package-age bypass, auth bypass, disabled audit or production Compose exception. Automatic deployment is explicitly approved below. AI review is optional and unconfigured; required correctness/security gates stay enabled. Shared workflow revision `3796eb299ba6447c55e667d1545115e24dfddf8f` (v1.10.0) was assessed during initial setup for historical reference only; it is not a CI dependency or a future migration target.

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

## Personal CI ownership — 25 October 2026

The owner explicitly requested that this personal repository not use the Codename CI wrapper for GitHub Actions. Inspection of both workflows and their local scripts at `9275e87` found no Codename execution dependency: validation runs here, and release calls `./.github/workflows/ci.yml`. Third-party actions are pinned directly; the only release credential is the repository's `GITHUB_TOKEN`.

The former access-based exception and proposed path back to shared workflows are replaced by permanent repository-owned CI. The agent instructions, copied CI guidance, acceptance checklist and README now reflect that decision. Workflow comments clarify local ownership; executable workflow definitions and all existing gates are unchanged. Application behaviour is unchanged, so there is no user-guide impact.

Current SOP retrieval was attempted with the installed read-only helper on 25 October 2026 but failed to retrieve/materialise the repository. No new source revision or current-policy adoption is claimed. This scoped change follows the owner's explicit instruction and the existing local baseline; unrelated standards remain at their recorded revisions.

Verification: source/file-size guardrails and `git diff --check` passed. Both workflow YAML files parsed and matched their pre-change definitions semantically; all external action references remained immutable SHA pins, and release's local CI reference resolved. Application tests and a remote CI result are not claimed for this documentation/comment-only change.

## Personal automatic releases — 25 October 2026

The owner explicitly requested: “once a release goes in, it build the GHCR image
or whatever, and auto deploys everything in Dokploy / Linode”. This authorises
release-triggered deployment to the personal account and supersedes the copied
manual-deployment/no-webhook default. The standalone CI ownership exception stays
in force. Codename's checked reference (`32f8d09013f1ab5f8ca336598659718f45c32b73`)
publishes version/latest images and invokes Dokploy after publication; this repo
implements that sequence locally without importing its workflow or credentials.

Current SOP main was retrieved through authenticated read-only SSH Git to a
separate snapshot at `2026-10-25T01:18:39Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`. Policy loading, environment/deployment,
testing and the local R01–R19 procedure were read. Relevant current execution
policy applies: focused local checks, full GitHub CI on the final commit before
an annotated tag. Existing repository-local release validation remains intact;
no unrelated shared-runner/workflow migration is adopted.

The owner explicitly selected `db` for the database name, user and password.
This scoped credential-strength exception does not authorise public database
exposure; keep the service on Dokploy's private network with no published port.
Authentication and bootstrap secrets remain independently generated strong values.

CI run `40169148974` proved the PostgreSQL health-check correction and passed
lint, typechecks, unit and database integration tests, then blocked on four high
advisories. Patch versions Vite 8.3.3, Zod 4.6.6, Multer 2.5.0 and the targeted
`express>body-parser: 2.4.0` override remediate them. Official npm publication
metadata places every patch before the 48-hour cutoff; no age-gate exemption or
audit suppression is added. Complete final CI and image evidence remain required.

The new hosting guide documents the actual personal deployment path. There is no
product UI change requiring a user-guide rewrite; readiness headers expose only
immutable release identity so automation cannot confuse an old healthy image with
the intended new release. Full Settings → System remains authenticated.
