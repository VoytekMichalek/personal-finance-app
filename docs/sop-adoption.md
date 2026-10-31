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

## Wide-screen content alignment — 26 October 2026

Current SOP main was retrieved at `2026-10-25T21:43:02.068Z` through the installed
read-only helper, revision `b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`.
Policy loading, application UI, testing and user-documentation guidance were read.
Focused local checks and full GitHub validation apply; the adopted baseline and
personal CI exceptions remain unchanged.

The content width cap now sits inside the sidebar-offset area, so wide-screen
pages centre in the available space with either sidebar state. Existing spacing,
mobile navigation and sidebar animation are retained. This visual correction
does not change a workflow or any user-guide instructions.

Local web typecheck, changed-file lint, guardrails and production frontend build
passed. The existing sidebar motion test passed ten consecutive runs at
2560 × 1440 with one worker and no retries; its screenshot was visually inspected.
All three existing sidebar/settings checks also passed at the normal desktop size.
The isolated browser harness uses port 3107 because another app occupies 3000.
Full desktop/mobile coverage remains in GitHub Validate; no release is requested
as part of this change.

## CSV uploads from accounts — 27 October 2026

Current SOP main was retrieved once through the installed read-only helper at
`2026-10-27T09:35:28.248Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, and held fixed for this task.
Policy loading, frontend/backend architecture, application UI, testing and user
documentation guidance were read against the adopted baseline. Current guidance
permits focused local verification and reserves full application CI for GitHub;
the personal CI ownership and documentation-navigation exceptions remain intact.
No unrelated standards migration or full current-policy adoption is claimed.

The existing CSV import is now available beside Upload statement on account
details, with that account preselected. Deterministic mapping suggestions cover
common headings and date formats, headerless files, signed or split amounts and
explicit reversed signs. Invalid/lossy source files fail visibly. Approval uses
the existing atomic, idempotent server commit with immutable preview dates/cents;
only approved mappings become the account's remembered defaults. Query/mutation
ownership now sits in a CSV feature hook. The maintained user guide describes
upload, mapping, review, approval, limitations and recovery.

This change introduces no dependency, environment input, database schema,
authentication, logging, deployment or release-workflow change. The owner
subsequently requested the overlap fix, automatic categorisation and a commit/release
of the next patch version, v0.0.3. Existing automatic deployment authorisation applies;
no new R01–R19 readiness decision is being introduced.

Focused verification passed on the working tree based on `15a5da7` with Node
24.21.0 and pnpm 10.34.6: source/file guardrails, changed-source ESLint, all three
workspace typechecks, shared/API/web builds, 34 selected parser/mapping/finance
unit tests and 13 real PostgreSQL CSV/finance integration tests. The upload
response-barrier test passed ten consecutive times without retries in desktop
Chromium and mobile WebKit. The complete affected CSV/journeys/statements browser
selection then passed all 26 cases on both projects in 2.1 minutes. Desktop/mobile
mapping and review screenshots were inspected, including overflow checks.
All database work used `finance_test` or `finance_e2e`. WebKit needed temporary
native libraries and a launcher as recorded in testing.md; no assertions, browser
projects or timeouts were relaxed. Full GitHub CI and release are not claimed.

Follow-up: long selected column names now truncate within their grid cells and
options wrap inside the dropdown. Headerless exports are detected automatically,
with an explicit override, so their first transaction remains available. CSV
previews use the same shared categorisation function as PDF statements (rules,
previous transactions and recognised merchants). Reviewed category overrides
remain authoritative when approved. All four version manifests are 0.0.3.

R17–R19 inspection for this release reviewed the unchanged service environment
examples/config loader, Docker build context and runtime, migration entrypoint,
error handler, Better Auth logging and opt-in diagnostics. Inputs remain runtime
server-owned; local files/secrets stay outside the production bundle. Expected
denials, validation and polls are quiet; unexpected errors retain sanitised events.
No new warning or security-incident subsystem is introduced. The repository-local
Validate/Release production-image smoke gates will supply exact-candidate evidence
for startup validation, preserved data, quiet defaults, diagnostic redaction and
fault reporting before deployment. Release run identities and rollout results are
recorded in the release handover after completion.

Final follow-up verification passed: guardrails, changed-source ESLint, all
workspace typechecks/builds, 51 selected shared/parser/statement unit tests and
24 real PostgreSQL CSV/finance/statement integration tests. The CSV response-barrier
journey passed 20 runs (ten per browser, no retries). After the dropdown wrapper
fix, the full affected CSV/journeys/statements/transactions/review-reports/AI-settings
selection passed 49 cases in 3.2 minutes; its existing desktop-only sidebar case
was inapplicable on mobile. Long-column desktop/mobile screenshots were inspected.
No test assertions, timeouts, browser projects or isolation boundaries were weakened.

## CSV reconciliation and account insights — 28 October 2026

Current SOP main was retrieved once through the installed read-only helper at
`2026-10-27T19:14:25.039Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, held fixed for this task. Policy loading,
architecture, application UI, testing and user-documentation guidance were read
against the adopted baseline. Focused local checks and repository-owned full CI
remain the applicable approach; no unrelated policy migration is claimed.

CSV review now reconciles a mapped running balance, exposes file coverage and
selected/excluded totals, and flags a bank/app difference before approval. AI
category responses use bounded batches, complete row-coverage validation, progress
and resumable retries. The provider schema lists eligible IDs; unknown, archived
or wrong-kind category IDs are left uncategorised without discarding valid labels; source rows, amounts and dates remain authoritative.
Account/global transaction filters share selection across all matching pages and
atomic optimistic bulk categorisation. Account history includes daily closing
balances and category spending drill-downs. Identity chips use stable colours with
text labels. The maintained user guide covers these flows and recovery.

No schema, dependency, environment input, auth, logging or deployment workflow
changes are introduced. The supplied bank CSV was inspected read-only; personal
rows are not included in fixtures, repository documentation or AI requests. All
automated financial tests use synthetic records in finance_test or finance_e2e.
At this checkpoint, no release or production ledger change was made. The owner
subsequently authorised the v0.0.4 release described below.

Verification on the working tree based on `3036191`: all 76 unit tests, all 58
real PostgreSQL integration tests, all workspace typechecks, lint, guardrails and
production builds passed. The three affected pending/retry/focus journeys passed
ten consecutive runs per browser with retries disabled (60 passes). The complete
affected account/CSV/transaction/expense/statement/settings browser selection then
passed 61 cases; its existing desktop-only sidebar case was inapplicable on mobile.
Desktop/mobile account-chart and mapping screenshots were inspected. Initial
fixture/selector failures were corrected, including giving the archived-category
regression its own temporary category; no assertion or timeout was weakened.
The final rate-limit separation retains 30 AI requests per minute per user while
allowing independent import approval; its exhaustion and successful commit path
passed the API integration suite. Real provider calls were not required for these
synthetic failure/recovery checks.

The local frontend is available at localhost:5173. During browser verification,
a temporary local launcher served the normal API on 3001 and proxied Vite to it,
while the isolated E2E API used 3000. Both local readiness and the frontend returned
200, and an unauthenticated proxied API request correctly returned 401. Repository
port/configuration conventions are unchanged. That local checkpoint preceded the owner’s request to commit and release v0.0.4.

## Bulk deletion and v0.0.4 release candidate — 28 October 2026

The owner requested bulk deletion, removal of the separate Refunds summary card,
and a commit followed by the next patch release. The fixed SOP snapshot above
remains in use; its newer shared-wrapper/build-metadata conventions are not
migrated. The permanent repository-owned CI and automatic deployment exceptions
remain authoritative. Root and workspace versions are now 0.0.4.

Filtered selections expose Delete selected on both global and account transaction
views. Confirmation freezes IDs and versions and counts linked counterparts
outside the filter. The API validates the complete confirmed transfer set and
rejects the entire deletion for receipts, missing entries or stale versions,
including rollback across deletion chunks. Tests mutate only isolated synthetic
records. Production household records are not edited by the release task. The
Expenses summary retains Spending and Net expenses; refunds still reduce totals.

Repository inspection for R17–R19 confirms no environment input, service ownership,
configuration phase, auth, logging sink or diagnostic-control change. New validation
and stale/receipt conflicts use the existing quiet 4xx path; no transaction bodies
or provider responses are logged. There is no schema/migration or dependency change.
The existing single API/webapp image and documented runtime-only root example
remain applicable. The required exact-candidate Validate/Release image smoke gates
will verify startup validation, quiet denials/polls, sanitised failure reporting and
diagnostic redaction before deployment; live release evidence belongs in handover.

Final working-tree verification passed: guardrails, lint, every workspace typecheck,
production builds, all 76 unit tests, all 62 real PostgreSQL integration tests and
all five deployment-script tests. The full affected browser selection passed 65
cases in 4.3 minutes, with the existing desktop-only sidebar case inapplicable on
mobile. Both new bulk-delete journeys passed on each browser, and confirmation
and two-card expense screenshots were inspected. The earlier 60 consecutive
pending/retry/focus passes remain applicable; no timing behaviour changed in this
last increment. No retries or assertions were weakened. The dependency audit
passed its high/critical gate with two moderate advisories recorded in hosting.md.
The local app remains on localhost:5173 with its normal database, separate from
finance_test and finance_e2e.

## Expense chart and transaction layout — 28 October 2026

Current SOP main was retrieved once through the installed read-only helper at
`2026-10-27T21:30:59.128Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, and held fixed for this task.
Policy loading, frontend architecture, application UI, testing and user documentation
were read against the adopted baseline. Current guidance permits focused local
checks and keeps full CI in GitHub. Repository-owned CI, build identity and the
existing documentation-navigation exception remain in force; no unrelated policy
migration is included.

Expenses now has a category-stacked chart with month, Monday–Sunday week and day
intervals. Integer-cent buckets retain quiet periods and clip the first/last period
to the selected dates. Refunds reduce their own category, with negative stacks below
zero. Existing filters and exact-category drill-down remain authoritative. The
category/account/person ranking is compact and scrollable; included transactions
use responsive columns/cards, ten-row pagination and reset on filter changes.
The shared detail dialog uses the same improved transaction presentation. The
maintained user guide explains all new controls and refund/date semantics.

This chart change adds no dependency, database schema, API, authentication,
environment input, logging, release or deployment configuration changes. It is a
scoped UI/calculation change, not a deployment-readiness assessment or a release.

Focused verification on the working tree based on `74c66fd` passed: all workspace
typechecks at the chart implementation checkpoint, changed-source lint/formatting,
source/file guardrails, shared/API/web production builds and 27 selected expense,
finance and colour unit cases. Web/shared typechecks were repeated successfully
with the concurrent expense-search changes present. The new chart browser file
passed all four desktop/mobile cases with one worker and retries disabled; the
other 20 selected expense-detail, account-insight and review-report cases passed
in the broader run. An initial fixture assumption of twelve starter categories
was corrected to check the actual seeded count while retaining the overflow and
last-category accessibility assertions.

Final browser command: `FINANCE_WEBKIT_EXECUTABLE=/tmp/finance-csv-webkit.sh mise exec -- pnpm exec playwright test e2e/expense-chart.spec.ts --retries=0 --reporter=list --output=artifacts/expense-chart-results` (4 passed, 38.5 seconds).
The separate output directory avoids trace-cleanup collisions with another active
finance chat. Browser/database runs were sequenced against finance_e2e; no real
ledger was reset. Desktop (1440 and 1714 pixels) and mobile chart/list screenshots
were inspected. Existing search/import work in the shared checkout was preserved.
These are focused local results, not full GitHub CI, publication or deployment.

## Import recovery and transaction discovery — 28 October 2026

Current SOP main was retrieved once via the installed read-only helper at
`2026-10-27T21:33:54.242Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, held fixed for this task.
The policy-loading procedure and relevant application UI, testing and user-guide
standards were read against the adopted `9335fad` baseline. Existing personal CI,
release/deployment and documentation-navigation exceptions remain unchanged. This
increment preserves the concurrently developed expense-chart work and does not
claim a broader SOP migration or a deployment-readiness assessment.

CSV/PDF import reviews now identify matching source rows and saved payments at the
top, offer exact-row navigation and explicit skip/link/separate-payment decisions,
and return structured conflicts after concurrent edits. Linking creates only the
missing account entry, retains the existing payment's history/attachments, and uses
version predicates with atomic rollback. Single deletion uses the same guarded
transaction service as bulk deletion to prevent a concurrent link leaving an orphan.
The PDF parser supports printed year headings and processed-date columns; a confirmed
Read again action refreshes only uncommitted saved previews. Search, Uncategorised
filters, clear controls and inline category editing are documented in the maintained
user guide. No private statement or transaction fixture is committed.

No dependency, schema/migration, environment input, logging sink, diagnostic control,
authentication or deployment configuration changes. Structured expected conflicts use
the quiet authenticated 4xx path; no financial descriptions or documents are logged.
This is local feature validation; no new release or deployment is performed here.

Working-tree validation based on `74c66fd` passed: production builds, every workspace
typecheck, repository lint, source/file guardrails, 89 unit tests and all 73 real
PostgreSQL integration tests. Five affected pending/polling/focus journeys each
passed ten consecutive times on desktop Chromium and mobile WebKit: 100 passes,
one worker, no retries (7.3 minutes). The full browser suite then passed 95 cases
with three existing platform-specific skips (7.0 minutes). No assertions, deadlines,
coverage or browser projects were weakened. A stopped interactive repeat process
was rerun to completion in a persistent runner; its partial result was not used
for the ten-run evidence.

Final review also made detail deletion submit the displayed IDs and versions,
preventing a stale standalone confirmation from expanding to a newly linked pair.
The web was rebuilt, all typechecks/lint/guardrails repeated, and all eight selected
transaction/deletion browser cases passed on the final build. The interactive
runner stopped after seven completed cases; the remaining mobile transfer case
passed separately (7.8 seconds). This final change does not alter the earlier
focus/polling behavior. Synthetic screenshots were inspected on desktop/mobile.
The user's PDF was verified read-only through native extraction and the parser:
307 source transactions, exact opening/net/closing reconciliation, no row errors
or reading warnings. No household ledger mutation was used for testing. Both
localhost:5173 and the local API readiness endpoint returned 200 at handover.


## Combined v0.0.5 release candidate — 28 October 2026

The owner explicitly authorised committing all shared-checkout changes across chats
and releasing the next patch version. This combines the expense-chart and import
recovery/discovery work above. All four workspace manifests identify v0.0.5; no
previous tag is moved. The fixed SOP revision and existing exceptions above apply.
The final review found no private source documents, secrets, migration, dependency,
environment or logging changes. The documented local results are reused for this
candidate; GitHub Validate must pass on its exact commit before the annotated tag
is pushed. Release then repeats required validation, smoke/security checks and
publication, followed by the existing exact-tag/commit production rollout check.
The workflow run and release provide immutable publication/deployment evidence.

## Remembered import categories and PDF reading — 31 October 2026

Current SOP main was retrieved once with the installed read-only helper at
`2026-10-31T07:18:33.111Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, and held fixed for this task.
Policy loading, architecture, application UI, testing and user-documentation
standards were read against the adopted `9335fad` baseline. Current guidance
permits focused local verification and retains full CI in GitHub. The personal
CI/release and documentation-navigation exceptions remain unchanged; this is not
broader SOP adoption or a deployment-readiness assessment.

CSV and PDF reviews now offer Remember category, matching full descriptions
without case/spacing differences across all review pages. Automatic assignments
are labelled and highlighted; edits and undo preserve explicit later choices.
Approval saves exact-description rules atomically with selected transactions.
A non-destructive migration adds the rule match mode, defaulting existing rules
to their original contains semantics. Exact rules precede broader rules and can
be edited, paused or deleted in Categories. Existing amounts, dates, selection,
refund/transfer handling and previously posted records retain their semantics.

PDF processing now scans pages automatically when the initial extraction has no
rows, including selectable headings above scanned tables. Empty AI results use
the deterministic reader where possible; unrecoverable empty results become a
recoverable failed job instead of an empty ready review. Re-uploading a failed or
older empty preview queues its original source again using the new upload options;
non-empty and committed reviews retain existing protection. Synthetic regression
fixtures cover both image-only and mixed text/image PDFs. The user's original
PDF was not supplied for this task, so its exact failure is not claimed reproduced.

The OpenRouter allowlist expands from six to eighteen models, retaining existing
IDs. Provider and model labels come from the official public models API retrieved
on 31 October 2026: https://openrouter.ai/api/v1/models. Every listed model advertises
structured outputs; require_parameters, denied data collection and ZDR routing
remain enforced. No account credentials or household documents were sent for
catalogue verification. Actual provider availability remains dependent on the
configured account and privacy-compatible routes. The model dropdown uses native viewport scrolling with a visible scrollbar;
Radix scroll-button focus restoration otherwise snaps this longer list back to
the initially focused option on mobile. Existing dropdowns keep their controls.

User guides cover remembering/undo, rule ordering, first-read recovery and model
labels. No dependency, environment input, logging sink, diagnostic setting,
authentication, release workflow or deployment configuration changes are included.
Validation evidence is recorded in docs/testing.md. The owner subsequently
authorised committing this work and releasing the next patch, v0.0.6, and directed
that only the last version number increase until instructed otherwise. This
preference is recorded in AGENTS.md and docs/hosting.md. Environment/deployment
and logging standards were also read for the release. Existing personal CI and
automatic-deployment exceptions override upstream shared-workflow/manual-deploy
guidance. The final commit must pass GitHub Validate before its annotated tag is
pushed; Release then validates, smoke-tests/scans, publishes and verifies the
production rollout against that exact tag and commit.

R17–R19 release evidence: inspection confirmed the single API/web image still
owns every runtime input in `.env.example` (`DATABASE_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, conditional `FIRST_USER_TOKEN`, optional `OPENROUTER_API_KEY`
and the four `R2_*` inputs). `apps/api/src/lib/config.ts` validates them at startup;
Docker build inputs remain immutable metadata only and `.dockerignore` excludes
local environment files. The additive migration is included by the existing
Prisma deployment/entrypoint path. Expected reader failures use `HttpError` and
remain quiet; the unchanged worker/error middleware emits only sanitised events
for unexpected failures. Better Auth logging remains disabled, while SIGUSR2
diagnostics use allowlisted fields and exclude health polls. No new warning
condition or security-incident subsystem was introduced. The required GitHub
candidate image smoke run covers disposable-database migrations/restarts/failure,
runtime validation, metadata, bundle secret checks, 401/403/400/404 responses,
quiet polls, diagnostic redaction and controlled unexpected faults. Its exact
commit/run identity supplies image evidence before publication/deployment;
source inspection alone is not recorded as an image-verification pass.

## Transaction review follow-up — 31 October 2026

Current main was retrieved read-only once with the installed policy helper:
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`, retrieved
`2026-10-31T09:30:15.202Z`. Policy loading, relevant architecture/UI, testing,
user-documentation, environment/deployment and logging guidance were read at that
fixed revision alongside the adopted local standards. The adopted baseline stays
`9335fad26de93124a891f6c6544bb388aa366084`. Current upstream testing permits focused
local verification and reserves complete validation for GitHub on the final commit;
this task follows that execution model. Personal repository CI, immutable metadata
names and the authorised automatic rollout retain their documented exceptions.

The owner reported changing IVV period/reference suffixes prevented immediate
remembering. CSV/PDF reviews now suggest a contains rule after stripping only a
recognisable trailing month/year/reference code; other descriptions remain exact.
The text/match mode are visible and editable, immediate updates show a count,
and approval persists that same rule atomically. Both matching modes normalise
case and whitespace. No AI call is needed. Rules are labelled Category rules in
Categories and linked from review. Existing exact-rule priority remains unchanged.

The transaction list now edits type inline on desktop/mobile and uses one coloured
bubble with its arrow inside for editable type/category values. Transfer conversion
requires the other account plus confirmation, links an explicitly selected existing
opposite payment or creates its balanced counterpart, and preserves original IDs,
receipts, source attribution and notes. Unlinking keeps both historical entries.
Version checks, consistent lock ordering, account/date validation and scheduled-item
protection are enforced in the service through shared Zod validation. The route
is thin; hooks own mutations and cross-disable type/category edits during saves.

User documentation describes these behaviours and where to manage rules. No database
migration, dependency, deployment input, logging sink, diagnostic switch, auth policy
or CI/release configuration changes are needed. R17/R18 source inspection confirms
the existing single API/web image and environment ownership/phases remain unchanged.
R19 inspection confirms new expected validation/conflict errors use HttpError and
remain quiet through existing middleware; no transaction descriptions are logged.
Exact-candidate GitHub image smoke/scan evidence is required before the authorised
patch release and production rollout. Local test evidence is recorded in testing.md.

The owner expanded this follow-up to the approximately 800 already imported rows.
Category bubbles now offer Remember & apply to similar, including uncategorised
rows; an inline-save shortcut improves discovery. The dialog previews the full
ledger across accounts/dates/filters, shows replacement counts and matching records,
and confirms the exact versioned set before atomically saving its rule and applying
categories. Server validation rejects stale, missing, added or mismatching records;
500-row chunks share one database transaction with rule persistence. Import approval
and ledger application use the same idempotent rule-storage helper. A derived
Matches saved rule marker highlights agreement with the highest-priority eligible
saved rule after paging/reload without claiming false application provenance or
adding a database field. No household data is modified by development tests.
