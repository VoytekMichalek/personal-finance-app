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

## First-release readiness verification — 25 October 2026

CI `40169530139` passed all existing gates for `c55f10894ed09b28fcb1ba8a8c691bdf08cbd371`, including image smoke and HIGH/CRITICAL scanning. Mapping that evidence to R01–R19 identified missing account-lifecycle/UI/restart cases and no supported optional request diagnostic mode. The focused follow-up adds those checks and a SIGUSR2 diagnostic toggle with allowlisted fields; no new runtime configuration or credential is introduced. The hosting guide documents enable/disable behaviour. There is no product workflow or user-guide change.

Focused API verification passed 19 tests in access, receipts and diagnostics integration files, with real isolated local PostgreSQL. API typecheck, changed-file lint, guardrails and a development build passed. Local browser execution could not start because localhost:3000 is already occupied; no other app was stopped and no passing browser result is claimed. The new browser and image assertions must pass in GitHub before release. The readiness report remains pending those results.


The expanded browser test in CI `40171229037` found a fixture problem (attempting
registration twice on one authenticator) and a real feedback defect: the custom
auth guard returned `error`, while Better Auth reads `message`. The guard now
returns the expected envelope, with API and real-browser regression coverage.
The user guide explains backup devices and the final-key safeguard.

After correction, all 14 access API cases and the complete real WebAuthn journey
passed locally. The browser harness used localhost:3107 without disturbing the
other application on port 3000; original CI configuration is unchanged. The final
local production image passed the extended disposable-database smoke checks,
including migrations, durable setup, data persistence and diagnostic redaction.
Its build marker is `pre-release-working-tree`, not an already published commit.
The scoped R01–R19 report now records a Ready to deploy decision with exact source
and evidence identity. Full GitHub CI on the final release commit is still a
separate requirement before tagging. The configured private R2 buckets and tested
initial backup are documented in hosting; live deployment and post-migration
restore evidence are still pending.

CI `40172183827` passed the corrected passkey journey and all other access/readiness
cases but exposed a pre-existing statement-review selector race. The test used a
generic checkbox while a React transition still displayed the previous step's
checked Include box. It now waits for the explicitly labelled final acknowledgement.
Ten consecutive desktop runs passed with retries disabled (44.3 seconds), using
the isolated local harness with only origin/listening port changed to 3107.
No application behaviour or user guide changed. Full affected desktop/mobile
coverage remains in the normal GitHub validation suite; release still waits for
a complete passing run. R01–R19 application evidence is unchanged by this test fix.

## First release and operational handover — 25 October 2026

Full Validate `40172824479` passed on the final release commit
`845cb7e75ee71a71e4af96eabf5bf47761bfadfe`: unit/integration tests, desktop/mobile
browser coverage, timing repeats, audit threshold, build, image smoke and scanning.
Only then was annotated tag `v0.0.1` pushed. Release `40173441861` repeated its
validation gates, published matching version/latest GHCR digests and automatically
deployed through the personal Dokploy webhook. Trusted live HTTPS readiness
reported the exact tag and commit. No Codename execution wrapper or organisation
credential was introduced.

Production private R2 put/get/delete verification and an isolated restore of the
post-migration PostgreSQL backup passed. The owner confirmed signing in and the
public status endpoint confirmed completed bootstrap. [hosting.md](hosting.md)
records image identity, backup evidence, optional AI configuration, the billing
handover and the assessed moderate dependency advisory. These final documentation
updates do not change application behaviour or require a user-guide rewrite.

## Michalek Finance branding — 25 October 2026

The owner selected the Blue Dollar favicon preview and named the app Michalek
Finance. The browser title, sign-in branding, desktop/mobile navigation, passkey
display name and OpenRouter attribution now use that name. The SVG favicon uses
the approved blue dollar on a pale rounded tile; its glyph licence is retained.
The user-guide introduction and existing image smoke expectation are updated.
The task continues against the policy snapshot recorded above; no infrastructure
identity, authentication origin or credential-encryption context is renamed.

Focused verification passed: web/API typechecks, changed-file ESLint, source/file
guardrails, the production frontend build, SVG parsing and whitespace checks.
The built frontend's title and loaded 32-pixel sign-in mark were inspected in the
browser. The owner subsequently authorised committing and releasing v0.0.2. All
four workspace/root version manifests are aligned to 0.0.2; the exact release
commit must pass GitHub Validate before its annotated tag is created. The existing
release workflow repeats validation and verifies automatic production rollout.

Release verification completed: full Validate `40178038924` passed on
`2a6024ba33e4b84757194bb1b46e55ca05aaed0c` before tagging; Release `40178724145`
passed every validation, publication and deployment job. Live trusted HTTPS
reported v0.0.2 and that exact commit, with the approved title/favicon and durable
completed setup. See [hosting.md](hosting.md) for image identity and rollout evidence.
