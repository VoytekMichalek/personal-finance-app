# Testing

## Local demo administrator shortcut — 8 November 2026

Verified the account-preview follow-up on the existing working tree (base
`8148f084a8ebfd6e5e21b30163b95e4889f67533`), preserving unrelated in-progress work:

- 19 policy unit cases pass: explicit opt-in/development mode, exact local demo
  database, loopback origin/socket, Host matching and forwarded-header rejection.
- 18 database-backed cases pass across `demo-login.integration.test.ts` and
  `access.integration.test.ts` using only `finance_test`. They cover real Better
  Auth cookies, the dedicated admin, one-hour expiry, logout revocation, blocked
  cross-origin/foreign-host requests, disabled identities, the ordinary app's 404,
  and existing role/bootstrap/invitation protections. The demo integration file
  mocks only the environment gate to exercise its actual session flow in the
  isolated test database; policy units cover the real gate separately.
- `pnpm build`, API/web typechecks, affected ESLint, guardrails and diff whitespace
  checks pass. The final API build includes the corrected expiry override. The
  production frontend contains neither the demo button nor its sign-in request.
- Focused Playwright `demo-boundary.spec.ts` plus `access.spec.ts`, one worker,
  retries zero: 3 passed, 1 existing mobile WebAuthn skip. Desktop verifies the
  real passkey lifecycle; desktop Chromium/mobile WebKit verify the production UI
  omits the shortcut even when status metadata advertises it. Negative assertions
  follow visible status completion. No new timing-sensitive tests or sleeps.
- Live Vite preview on localhost:5174 verified the actual demo button, successful
  admin sign-in, demo banner and all 14 sample account cards. Its proxy preserves
  the incoming Host for the demo guard. The API binds to 127.0.0.1. Screenshot:
  ignored `artifacts/demo-admin-signed-in.png`.

R17/R18 source review: process-only demo flag and secret, no new deployment input,
no frontend secrets, production guard fails closed, existing image/startup remain.
R19 source review: expected denials retain quiet existing handling; the success
audit contains IDs/action only. Production-image R17–R19 verification is not
claimed for this local-only preview; no release or deployment was requested.

Use Node/pnpm from mise. Start the local PostgreSQL service and run `pnpm ci:prepare` to compile shared schemas and generate Prisma, then run `pnpm ci:validate`. Install only the two required browsers once: `pnpm exec playwright install --with-deps chromium webkit`. CI installs native libraries; developer machines may need the same installation. E2E serves the existing production build; it never rebuilds or installs browsers.

Unit tests own integer money/date calculations, owner filtering, refunds/transfers, budget boundaries, month-end recurrence, forecast double counting, recorded net worth and CSV/AI validation. Integration tests use actual PostgreSQL plus the Express API for permission, persistence, optimistic races, serialized admin safeguards, atomic imports, duplicate confirmation, occurrence uniqueness and authenticated private receipts. R2 failure fixtures test compensation and retry semantics; live R2/OpenRouter account verification is separate.

`pnpm test:integration` creates/migrates only finance_test (or isolated CI app_test). Playwright uses finance_e2e and a fresh synthetic auth secret. Never point these commands at a production or household database. Fixtures reject unexpected database names. One E2E worker is intentional: both viewport projects reset one household fixture database; concurrent resets would invalidate another journey. Unit test files run independently; API race tests run concurrent requests within their isolated fixture. Browser engine startup/migration is reused for all journeys.

Desktop Chromium uses a CDP authenticator to exercise actual WebAuthn enrolment, spouse invitation, sign-in and logout. Mobile WebKit tests the financial journeys using real server-verified sessions; it does not claim native OS credential automation. Real server/database operations use observable UI/network readiness. The CSV pending-state test uses an explicit response barrier installed before upload, no sleeps. It must pass ten consecutive no-retry runs on both projects:

```sh
pnpm exec playwright test --grep @timing --repeat-each=10 --retries=0
pnpm exec playwright test --grep 'keyboard focus' --repeat-each=10 --retries=0
pnpm test:e2e
```

Screenshots are written to ignored artifacts/overview-desktop.png and overview-mobile.png and inspected at actual sizes. Traces/screenshots for failures are ignored and may contain synthetic invitation tokens; do not publish them without review.

Build and inspect the production image locally, then `IMAGE=personal-finance:verification pnpm ci:smoke`. The smoke script creates and removes a disposable Docker network/database; it checks fresh/current committed migrations, startup failure before readiness, non-root runtime, required configuration, metadata, quiet polls and redaction. CI also scans the image with Trivy and blocks high/critical findings. Audit high/critical failures need a documented maintainer exception; none is approved here.

Run `pnpm integrations:verify` after credentials/model selection. A passing synthetic round trip is required to confirm the actual OpenRouter account and private R2 bucket; fixture passes cannot supply that evidence.

Local capacity: browser repeats normally take roughly 3–4 seconds per journey with one worker. Running a container build at the same time caused host memory/I/O contention and exceeded the unchanged 30-second test deadline. Keep image builds and browser runs sequential, as CI does. This is an execution resource boundary; no retries or relaxed assertions are used.

This checkout's initial WebKit verification used temporary host libraries and a launcher because system dependency installation required sudo. While those temporary files remain, run browser commands with `FINANCE_WEBKIT_EXECUTABLE=/tmp/finance-webkit.sh LD_LIBRARY_PATH=/tmp/finance-browser-libs/usr/lib/x86_64-linux-gnu` before `pnpm`. See verification.md for the environment evidence; install normal native dependencies for a durable setup.

Statement import coverage: parser/provider units own all-page coverage, source-value validation, ambiguous dates, reconciliation and recurring detection. A synthetic six-page statement spans January–June with independent known totals. A separate image-only fixture exercises real Poppler/Tesseract OCR. Database tests own atomic opening/transaction/schedule commits, idempotency under concurrent confirmation, protected downloads, source tampering, and category hierarchy constraints. Desktop/mobile browser tests own the account setup review, accepted suggestions, downloads, account/wealth navigation and keyboard dropdowns. The existing shared E2E database still requires one worker; unit files run independently. Synthetic fixtures never touch the household database.

Background statement jobs: API integration tests own persistence before processing, duplicate uploads, incomplete-review rejection, failure/retry, lease recovery and stale-worker fencing. Native PDF integration tests now explicitly claim and finish jobs so their source-value and financial assertions remain unchanged. Browser tests own leaving the saved processing screen, returning after processing and reloading the persisted review. The browser clock is installed before navigation; a response barrier controls pending UI while real worker completion is observed through the API. Sidebar motion tests sample actual compositor frames (CSS transitions are not JavaScript timers), checking stable icon geometry, matched content motion, interpolated reversal and reduced-motion behavior. Run both new browser files ten times without retries, followed by the affected suite. The shared fixture database still requires one worker.

Review/report regression coverage: shared expense tests verify exact cents, refunds, transfer/income exclusion, date boundaries, people/account filters and parent-category descendants. Statement reader tests cover previous-card-balance labels, adjacent amount lines, transactions before the printed period, changing references, missed periods and two-observation insurance candidates. Database tests verify an earlier opening anchor and rollback/recovery when a repayment predates the other account. Desktop/mobile journeys exercise wrapping descriptions, owner defaults, in-review category creation, expense filters, and asset/liability valuation edits surviving reload.

Repeat runs restore the seeded category baseline in `finance_e2e` as well as clearing synthetic transactions and users; categories created during classification must not accumulate between journeys. The fixture checks the isolated database name before truncation and reuses the committed starter-category SQL. Post-import recurring tests verify that only current posted evidence is used, existing providers are excluded, explicit acceptance is required, and the transaction ledger remains identical after saving schedules.

Expense drill-down coverage: shared unit cases verify that exact-category/account/person selections retain the active report filters, distinguish uncategorised spending, and reconcile daily/monthly buckets with refunds and zero-spend periods. The focused expense-details browser journeys verify filtered transaction counts and exclusions, trend values, dialog focus return, desktop/mobile overflow and the compact native colour control. These interactions use observable readiness and have no added timers, sleeps or retries.

Release-readiness coverage now explicitly exercises used invitations, demotion and session revocation, preserved financial history after user deletion, and both last-admin operations. `e2e/access.spec.ts` extends the existing real WebAuthn journey with concurrent bootstrap completion, invitation copying and own-passkey replacement/removal. `e2e/readiness.spec.ts` covers representative user details, deliberate reset/delete confirmation and System values compared with the generated build artefact on desktop/mobile. Existing financial journeys remain in `journeys.spec.ts`.

The image smoke test also checks bootstrap stays closed after container replacement without FIRST_USER_TOKEN and after user deletion/restart, and verifies retained account data. Default and signal-enabled diagnostic logging are exercised with secret markers, denied/invalid/missing requests, quiet polls and a controlled missing-table fault in the disposable database. No production data or credentials are used.

The statement-review confirmation check names its final acknowledgement checkbox.
Step navigation uses a React transition, so a generic checkbox selector can still
find the preceding review screen's already-checked Include box. Waiting for the
labelled confirmation control proves the new screen is ready without sleeps.

CSV account upload coverage: parser/mapping units own delimiter detection,
automatic headerless detection, duplicate/empty headers, exact cents, explicit reversed signs,
date-format suggestions, compatible saved mappings and row limits. Real PostgreSQL
tests in `csv-import.integration.test.ts` own authentication, preview-only state,
approval-only mapping/transaction persistence, source-date enforcement and archived
accounts; existing finance integration cases retain concurrency, amount-tampering,
refund and linked-transfer coverage. `csv-import.spec.ts` and the CSV journeys own
account-context navigation, editable suggestions, approval, exclusion, duplicate
warnings, recoverable upload errors, reload persistence and desktop/mobile layout,
including long selected column names and wrapped dropdown options. Shared
categorisation tests cover rule priority, history, recognised merchants and category
eligibility; API/browser tests verify automatic CSV categories and approved edits.
The held-response journey releases its barrier in cleanup and runs ten times per
browser with no retries. No timer deadline is introduced by this flow.

These checks reuse the existing production build and one browser worker because
the journeys reset the same `finance_e2e` database. Parser units and typechecks can
run alongside database integration in the separate `finance_test` database.
For this checkout's 27 October verification, missing WebKit native libraries were
extracted into `/tmp/finance-csv-libs`; the temporary launcher
`FINANCE_WEBKIT_EXECUTABLE=/tmp/finance-csv-webkit.sh` preserves that library path.
This local workaround does not change CI's browser/native-dependency installation.

Account history and large CSV coverage (28 October): pure tests own exact daily
closing balances, opening boundaries, quiet days, refunds/transfers, identity
colours and running-balance reconciliation in both source orders. API tests own
complete AI row coverage, safe handling of unknown/archived/wrong-kind categories,
the 25-row limit, independent AI/approval rate limits, a real 620-row atomic CSV
commit, and multi-chunk bulk category rollback after a stale version. The browser
journeys in account-insights.spec.ts cover all-page selection under account/search/
category filters, hidden-row preservation, history ranges and category drill-down.
The csv-ai.spec.ts response barrier proves pending state before an interrupted
batch, then resumes only unfinished suggestions and commits all 620 source rows.
Run this timing journey ten times without retries on both browser projects,
followed by the affected CSV/account/transaction/expense/statement suites. These
checks reuse the existing production build and one E2E worker; API tests use the
separate finance_test database. No real household CSV is used in fixtures.

For this local verification, the host lacked Tesseract. A temporary executable in
/tmp/finance-ocr-bin runs Tesseract from the existing personal-finance:verification
image with no network and /tmp mounted for scratch images. This preserves the
real OCR regression assertion without installing system packages. CI and the
production image continue to install the native tools normally.

Bulk deletion coverage: real PostgreSQL tests verify authenticated, unique and bounded
selections; 619-row deletion; rollback of earlier chunks on a stale version; and
confirmed transfer counterparts with receipt protection. Desktop/mobile journeys
exercise cancellation, filtered multi-page deletion, preserved hidden rows, refreshed
balances, global-page deletion, and recovery after receipt/version conflicts. These
use real isolated database/API completion, with response waits registered before
actions and no added timers. Expense report journeys retain refund-adjusted totals
after removing the separate Refunds summary card.

Expense chart coverage: `expense-category-trend.test.ts` owns exact signed cents,
category-stack reconciliation, zero-net categories, income/transfer exclusion,
quiet periods, clipped date ranges, Monday–Sunday weeks across years, leap days and
calendar dates around DST. It composes the existing filtered expense report rather
than introducing a second filter implementation. `expense-chart.spec.ts` exercises
all three intervals against real persisted synthetic data, visible stacks, the
accessible values table, refund labels, compact height, horizontal chart scrolling,
transaction pagination/reset, long descriptions and empty filters on both browsers.
The existing expense detail, ownership and account insight journeys retain their
coverage. No deadlines, debounce, loading barriers or retry timing are changed;
readiness uses observable rendered state and real API completion. Browser execution
keeps one worker because fixtures share finance_e2e; pure tests and typechecks can
run independently. The production build is reused across browser runs.

Import recovery and search coverage (28 October): synthetic BOQ-style PDF fixtures
own hyphenated day/month dates, printed year headings across New Year, processed-date
columns, wrapped descriptions and exact running-balance reconciliation. Actual
Poppler extraction and PostgreSQL tests verify persistence, original source values,
explicit ready-preview rereading, committed protection and re-read/commit races.
The supplied household PDF was checked read-only; it is never a committed fixture.

Import conflict integration tests own complete row/match details, explicit duplicate
overrides, exact-opposite linking without a duplicate counterpart, preserved receipts/
notes/ownership/import attribution, stale or reused choices, scheduled-payment guards,
and atomic rollback after a concurrent edit. Single-delete coverage guards against
orphaning a payment linked concurrently. Desktop/mobile import journeys own top-of-review
conflict discovery, exact row navigation/focus, matching-payment links, confirmation,
skipping, explicit separate payments and successful persistence. Cached empty PDF
recovery uses a response barrier plus the installed browser clock for polling.

Shared expense tests own search and uncategorised filtering consistently across totals,
chart inputs, included transactions and drill-downs. Browser journeys own clear-X and
Escape focus, optional date clearing, account-scope preservation, inline category
eligibility/persistence and recovery after a real stale write. Repeat affected pending,
polling and focus cases ten times per browser without retries, then run the affected
suite. Existing build reuse and the single finance_e2e worker remain required; API
checks run independently in finance_test. No timeout or assertion is weakened.

Remembered import categories (31 October): shared tests own matching across pages,
case/whitespace normalisation, income/refund/transfer eligibility, undo, edited
rows and replacing the remembered source. Real database tests exercise CSV and
native PDF imports, approval-only rule creation, atomic rollback, idempotency,
future matching, category replacement and unrelated descriptions. Existing contains
rules keep their semantics through the additive match-mode migration.

The first-read PDF checks cover image-only and mixed selectable-header/scanned-table
fixtures through real Poppler/Tesseract and the complete reading coordinator.
Focused reader units cover empty AI recovery and bounded OCR fallback; worker
integration covers re-uploading old empty results and committed protection. Browser
coverage proves a first upload reaches its review without Read again, alongside
persisted background and explicit rereading journeys. Their controlled progress
responses and preinstalled clocks retain real backend completion boundaries.

The AI settings journey saves existing/new models with maker/name labels and
exercises a model beyond the initial visible mobile dropdown options. Desktop and
mobile import journeys check cross-page highlighting, undo, future-rule labels,
real persistence and horizontal layout. Browser runs share finance_e2e and one
worker; isolated API checks use finance_test. Builds are reused between repeat
and affected-suite runs; no household database reset or provider call is used.

Local v0.0.6 evidence (31 October, Node 24.21.0/pnpm 10.34.6):

- `pnpm ci:prepare`, `pnpm build`, `pnpm typecheck`, `pnpm lint`,
  `pnpm guardrails` and `git diff --check` passed.
- Focused Vitest units passed 50 tests in eight files: shared import-review and
  categorisation, CSV parser, OpenRouter, statement AI reader, reader coordinator,
  statement parser and native PDF/OCR. The OCR run used the existing local
  Tesseract container wrapper in `/tmp/finance-ocr-bin`; CI installs native tools.
- Isolated finance_test checks passed 48 unique tests across finance, CSV import,
  import conflicts, statements, bank statements, statement jobs, remembered
  categories and AI settings. The additive migration applied successfully to
  finance_test and finance_e2e; no household database was used.
- `playwright test` on remember-category, statement-background,
  statement-reread and ai-settings, filtered to `@remember-pdf-timing`,
  `@statement-background`, `@statement-reread` and the AI-save journey, passed
  80/80 cases with `--repeat-each=10 --retries=0` on desktop Chromium/mobile
  WebKit. One worker owns the shared finance_e2e database. The existing local
  WebKit wrapper supplies native libraries; CI installs both engines once.
- The final affected browser suite passed 65 cases (one desktop-only sidebar
  check intentionally skipped on mobile), with zero retries, in 4.7 minutes:
  remember-category, category-rules, ai-settings, csv-import, csv-ai, statements,
  statement-background, statement-reread, statement-conflicts, import-conflicts,
  import-link-choices, review-reports and journeys. It reused the final build;
  no application code changed after that build.

The initial broad browser run found ambiguous legacy category selectors matching
the new checkbox; selectors now require the exact category label, preserving all
assertions. The longer AI dropdown also exposed mobile scroll-button focus
restoration; its native scrolling fix passed both browsers and the repeated runs.
Desktop/mobile review screenshots were inspected for the category tint/badge and
layout. Full CI, audit and candidate image smoke/security checks run in GitHub on
the final pushed commit and again through the repository-local release workflow.

Transaction review follow-up (31 October): shared tests cover changing bank
month/reference suffixes, editable exact/contains matching, whitespace, undo and
non-matching issuers. Real PostgreSQL integration tests own inline type changes,
receipt/source preservation, balanced counterpart creation, linking without
replication, concurrent opposite-side links, unlinking without deleting history,
account/date guards, category compatibility and scheduled-payment protection.

Ledger categorisation tests apply one rule to 800 existing payments across accounts,
exclude income/transfers when remembering an expense category, preserve dates/cents/
notes/receipts, and verify future application. Versioned full-set confirmation rejects
stale/incomplete/invalid requests. An injected rule-write failure inside a real
620-row database transaction proves rollback of every category chunk and successful
recovery without duplicate rules. Import and ledger persistence share one helper;
the existing CSV/native-PDF approval/concurrency tests continue to run.

Desktop/mobile browser coverage checks compact type/category bubbles, inline transfer
link/create/unlink, cancellation, reload persistence, stale edit recovery, immediate
cross-page IVV categorisation and future rule matches. The ledger journey reviews
800 matches despite a one-row/account filter, exposes category replacements, verifies
cancellation, applies all matches, pages through highlights and reloads them. A held
response proves pending state before a real stale write, then refresh and recovery.
Clocks are installed before navigation for timing cases; response waits precede
mutations. Browser runs remain sequential with one finance_e2e worker, reuse the
production build, and never reset household data. Integration uses finance_test.

Local v0.0.7 checks use Node 24.21.0/pnpm 10.34.6 and the existing temporary
WebKit library launcher. Shared categorisation/import-review/finance units passed
25 tests. The final focused API suite passed 27 tests in five files: ledger
categories, transaction types, remembered import categories, finance and import
conflicts. `ci:prepare`, production build, all workspace typechecks, lint, guardrails
and diff whitespace checks passed. No schema migration or dependency changes are
required.

Initial browser runs caught two fixture/assertion issues: the new synthetic PDF
credits needed explicit plus signs for the reader's existing sign-safety check,
and the rule-management locator needed the displayed Contains label around its
pattern. Both were corrected without changing source-value safeguards, deadlines,
retries or assertions about the complete transaction set. The 800-row desktop/
mobile workflow then passed with cancellation, replacement counts, cross-filter
application and reload persistence intact. Screenshots of the ledger, compact
bubbles and matching-rule dialog were inspected on both viewports.

Ten consecutive no-retry runs passed on both browsers for each affected timing
flow. The first 60-case run covered PDF remembering, inline category pending state
and inline type pending state. After the ledger scope was added, the final 60-case
run covered PDF remembering, inline category pending state and ledger remembering
(`--grep '@remember-pdf-timing|@timing' --repeat-each=10 --retries=0`, 4.8 minutes).
The inline type implementation was unchanged between those runs. Each run used
one finance_e2e worker and a reused production build; no retries, sleeps or weakened
assertions were introduced.

The final affected browser suite covered 14 files (78 scheduled cases). It passed
76 cases with one intentional desktop-only skip; the remaining mobile bulk-delete
case stopped solely at WebKit's 32,767-device-pixel screenshot limit on the longer
50-row ledger. Its full-page capture now uses CSS-pixel scale, retaining all content
and functional assertions. Both bulk-delete journeys were rerun on both browsers:
4/4 passed. This completes 77 unique applicable affected cases with zero retries.
The suite covered ledger categories, transaction types/categories, remembered
categories, category rules, CSV import/AI, transaction forms/detail deletion,
account insights, bulk deletion, review reports, AI settings and core journeys.
No application code changed after the final production build. Full repository CI,
audit and exact-candidate image smoke/security checks remain owned by GitHub
Validate and the repository-local Release workflow.

Filtered transaction rules and expense controls (1 November): shared tests own
intersection of ledger filters, transfer account/direction matching, valid pairs,
future transfer eligibility, and union/intersection of multiple expense filters
without double-counting parent/child category overlap. Real PostgreSQL tests own
complete filtered ID/version validation, incoming/outgoing transfer pairs,
confirmed existing or new counterpart entries, receipt/note preservation, hidden
rows, reused/stale/scheduled choices, atomic rollback, reusable rules and future
CSV/native PDF previews including paused rules.

The dedicated Remember button and confirmation are exercised across 800 category
matches and 55 filtered transfer matches across pages. Desktop/mobile coverage
checks cancellation, matching-month/account scope, ambiguous counterparts, saved
highlights, editing/pausing rules, and recovery from a concurrent change. Expense
journeys retain prior chart totals, interval ranges, refunds, pagination and
search/drill-down assertions while replacing single selection/disclosure controls
with checked multi-selection and keyboard-operable Graph/Table tabs. Legend and
confirmation screenshots are inspected at desktop and phone widths. Pointer
selection preserves focus without the unwanted chip ring; keyboard navigation
still shows its focus indicator.

The existing response-barrier remembering case is repeated ten times per browser
with retries disabled before the affected suite. No arbitrary waits or relaxed
assertions are added. New ordinary interactions use real API completion and
observable UI readiness. Builds are reused; one E2E worker remains necessary for
finance_e2e fixture isolation, with finance_test checks running independently.

Local v0.0.8 evidence (1 November, Node 24.21.0/pnpm 10.34.6):

- Shared build, Prisma generation, API/web production builds, all workspace
  typechecks, lint, guardrails, focused formatting and `git diff --check` passed.
- 28 shared tests passed across expense reports/trends, categorisation, import
  review and transaction rules. 23 API integration cases passed across ledger
  categories, remembered transfers, inline types and remembered CSV/PDF categories.
- The held-response ledger remembering case passed 20 runs (ten per browser,
  no retries), followed by all 48 affected desktop/mobile journeys. The new
  multi-filter and transfer-confirmation journeys also passed their focused run.
- Chip pointer/keyboard focus was checked with 40 consecutive interactions:
  ten type and ten category cycles in each browser. Pointer selection retained
  focus without the outer ring; Tab/Shift+Tab/Enter/Escape retained keyboard focus
  visibility. Existing form-focus regressions passed on both browser projects.
- Desktop/mobile chart legends, multi-selection reports, transaction bubbles and
  transfer confirmations were visually inspected. Temporary WebKit/native OCR
  launchers remain local-only; CI installs native dependencies normally.
- Production image `personal-finance:verification-v0.0.8`, metadata
  `0.0.8 / unreleased / working-tree-v0.0.8`, image ID
  `sha256:ffbca935292ef7b0cece0fcc981073bc428195b09553a968a67590a69bccc08b`,
  passed `pnpm ci:smoke` with only
  disposable containers/databases. The checks cover fresh/pending/current
  migrations, preserved data and startup failure before serving, durable bootstrap,
  non-root execution, required configuration, frontend/auth, quiet denials/polls,
  optional diagnostics and redacted unexpected failures (R17–R19). No registry
  publication or production database was required for this evidence.

Full repository validation, audit and image scanning remain required in GitHub
Actions for the exact final commit before tagging; release validation and verified
rollout remain enforced by the existing repository-local release workflow.

The local-preview wording follow-up makes future rule creation explicit in the
Remember confirmation and user guide. Existing ledger-category and remembered-
transfer integration suites passed again (14 cases), including real future CSV
and PDF review and rule pausing. Web typecheck, focused lint, guardrails and diff
checks passed. This is a copy/layout clarification; no matching, persistence or
timing behaviour changed, so prior behaviour/timing evidence remains applicable.

Full CI exposed two pre-existing browser locators affected by the new Remember
button: a broad description regex matched both row actions, and the amount shared
its text container with the mobile action. The row locator now anchors the
description and the amount has its own span. Both original journeys passed on
desktop and mobile (four cases, zero retries), with all financial and persistence
assertions retained. These checks used finance_e2e and a temporary port 3002
configuration to keep the user's preview on ports 3000/5174 running. Web build,
typecheck, focused lint, guardrails and diff checks passed; no timing changed.

Statement transfer/reconciliation follow-up (1 November): shared tests own unique
account/date/signed-amount matching, ambiguity and complete balanced-pair checks,
plus account-specific and household-neutral recurring-transfer forecasts. Real
PostgreSQL tests own incoming/outgoing schedule choices before and after import,
posted transfer evidence, occurrence concurrency, existing-pair matching, invalid
accounts and atomic rejection. Reconciliation checks retain source amounts/dates,
notes, owners, receipts and counterpart provenance, reject changed/reused/already
claimed entries, and roll back accepted matches when another row fails. Opening
balance tests cover both existing balances and history added after review began.

Desktop/mobile journeys cover bulk acceptance across review pages, undo, ambiguous
rows, accurate projected balances, PDF reconciliation, preserving opening balances,
transfer type/account controls before and after import, Plan editing, and creating
and immediately applying a category from the transaction bubble. They use observable
UI/API completion with no new sleeps or relaxed assertions. Existing PDF remembering
and category pending-state timing cases run ten consecutive no-retry invocations,
then the full affected browser suite. One worker owns finance_e2e; independent API
checks use finance_test. The user's preview stays on 3000/5174, while a temporary
port-only copy of the tests runs on 3002 using the same production build and original
assertions. Temporary native WebKit/OCR launchers are local-only; CI installs the
required tools normally. No household database or shared object storage is changed.

R17/R18 source inspection confirms unchanged runtime input ownership, separate local
configuration, build-context exclusions and automatic migration-before-serving.
R19 inspection covers the existing quiet expected-error handler, disabled Better
Auth logger, sanitised unexpected errors and allowlisted SIGUSR2 diagnostics.
The exact final commit must pass the repository's GitHub Validate workflow, including
isolated production-image smoke checks and security scanning, before the annotated
patch tag. Release repeats those gates before publication and verifies live rollout.
This reuses exact-candidate CI evidence for R17–R19 rather than requiring registry
publication or household data for application verification.

Local follow-up evidence: 38 focused unit cases and 53 distinct PostgreSQL
integration cases passed. The affected PDF remembering and inline category
pending-state cases passed ten consecutive invocations on desktop and mobile
(40 cases, zero retries). All workspace typechecks, lint, source/file guardrails,
production builds and diff checks passed. Browser coverage exposed a missing
accessible account label, which was fixed, plus stale summary/forecast text
locators and an overly broad checkbox locator; the locators now target the
updated copy and the named confirmation control without weakening persistence
or balance assertions.
The final full affected browser suite passed all 76 desktop/mobile cases with
zero retries (4.9 minutes), using the same production build. Logs and screenshots
are retained locally under ignored `artifacts/v0.0.9-*` and the browser report.

Transfer classification follow-up (v0.0.10): shared unit checks own Uncategorised
filter semantics for income, expenses, refunds and both sides of transfers, plus
intersection with account/type filters. Expense report fixtures explicitly include
an uncategorised transfer to protect its existing exclusion. PostgreSQL integration
checks own filtered remembering after the converted source leaves the category/type
filter, preserving its original pair, rejecting confirmation sets that include
excluded transfers, and keeping ordinary category remembering unchanged.

Desktop/mobile journeys own automatic discovery after saving a type, confirmation
before any other payment changes, cancellation, exact account/month/category/type
scope, pairing existing entries without duplication, future-rule persistence,
Uncategorised counts/selection and persistence after reload. A response barrier
holds the type save to prove the pending state before the confirmation can appear;
the browser clock is installed before navigation. No arbitrary waits are added.
The two automatic-confirmation contexts and existing type pending/stale recovery
cases run ten consecutive times with retries disabled, then the full affected
transaction suite. Mutable finance_e2e fixtures retain one worker; independent
finance_test integration and pure unit/typecheck work run concurrently. The same
production build and port-only local test harness described above are reused.

The fixed SOP revision, configuration/logging inspection and exact-candidate image
smoke/scan requirements remain as recorded above. The patch changes no runtime
inputs, schema, deployment policy or dependencies. The previous exact-commit
Validate job took approximately 26 minutes; this patch adds 40 timing repetitions
and ten browser cases. The overall CI job budget is therefore 45 minutes instead
of 30. Individual test deadlines, zero retries, assertions, thresholds, worker
isolation and all release gates stay unchanged. Local logs use ignored
`artifacts/v0.0.10-*`; full main and release workflows validate the final commit
before publication and verify its production rollout.

Local v0.0.10 evidence: 13 focused unit cases and 22 PostgreSQL integration
cases passed. All 60 timing cases passed across ten repetitions on desktop/mobile
with zero retries (4.4 minutes), followed by all 46 affected browser cases
(3.7 minutes). All workspace typechecks, lint, guardrails, production build and
diff checks passed. Desktop/mobile confirmation screenshots were inspected.
An initial global-list reload assertion matched both sides of a valid transfer;
the test now restores its account filter before asserting the original row,
retaining the balance, persistence and hidden-record assertions.

## Recovery, editable expense categories and asset transfers — v0.0.11

Shared units cover missing-year/leap-day parsing, source-date lookup and preserving
review choices after verified corrections. Real PostgreSQL tests own durable PDF
date repairs, duplicates, source day/month/year and amount enforcement, future-date
rejection, concurrent repairs, committed-review protection and editable reread
options. Browser journeys exercise an invalid year followed by pending/successful
repair, retained categories, import completion and individual dates across New Year.

Asset-transfer units own signed contributions, withdrawals, repayments and borrowing;
closing-valuation boundaries; movement history; and exact cash, forecast and net-worth
totals without double counting. Integration tests execute the additive migration
against isolated legacy tables, preserve valuations, and cover account/type guards,
balanced pairs, old-transaction conversion, filtered remembering and future imports.
Desktop/mobile journeys create assets and liabilities, record contributions and
repayments, update valuations and verify the saved movements and totals after reload.

Expense remembering uses the same server-recomputed date/account/person/category/
search/drill-down intersection as the displayed report. Integration tests reject
hidden or stale confirmation sets and verify future-rule persistence. Browser checks
edit categories and create a category from Expenses, its drill-downs, Overview and
transaction details, including filter changes, hidden records and reload persistence.

The complete error-surface inspection is recorded in `error-recovery-review.md`.
Browser coverage holds a failed form response, proves pending state, preserves
entered values and checks refresh does not replay a write; it also retries the
retained PDF upload, recovers a failed file download, and refreshes a stale deletion
inside its still-open detail dialog before explicitly confirming both transfer sides.
Release-history checks verify every entry, the installed version marker and phone
overflow. Screenshots cover phone/desktop date repairs, forms, category editing,
asset/liability history and release notes. Existing auth, receipt, import, planning
and financial journeys retain their real API/database assertions.

Clocks are installed before navigation in the new timing cases. Response barriers
are installed before actions and released in cleanup; no arbitrary sleeps or retry
allowances are added. All timing cases run ten times without retries, followed by
the full browser suite. Runs reuse the existing production build; source refinements
receive a fresh build and affected checks. One worker owns the shared
finance_e2e fixture; independent unit and finance_test integration checks can run
concurrently. The existing port-3002 test copy changes only localhost origin strings,
keeping the owner's preview available on 5174/3000. Native OCR/WebKit helpers remain
local-only. Household data and external object storage are never reset or used.

R17/R18 inspection confirms unchanged runtime inputs and secret-free image boundaries,
separate local configuration, the single API/web image and committed migration-before-
serving. The new migration adds associated accounts without changing asset valuations
or existing transactions. R19 inspection confirms expected correction/validation
failures retain quiet HttpError/Zod handling, Better Auth logging stays disabled and
unexpected failures remain sanitised. Exact-candidate main CI must pass isolated
production-image smoke checks and scanning before tagging; release repeats those
checks before publishing and verifies the exact version/commit on the live service.
No registry publication or household data is used as a substitute for those checks.

Local v0.0.11 evidence: all 119 unit cases, 121 PostgreSQL integration cases and
five release-script cases passed. Guardrails, lint, every workspace typecheck,
production builds and whitespace checks passed. Dependency auditing found no
high/critical issues; the three existing moderate items were not suppressed.
The full browser suite passed 153 cases with three intentional mobile exclusions
and zero retries. Final AI-settings navigation refinements passed all 16 affected
desktop/mobile cases; final PDF date-repair assertions passed 20 timing repetitions.

The initial 180-case timing run reported every case passing, but its local wrapper
exited with signal 143 during cleanup. A replacement completed all 90 desktop
repetitions before the local runner was interrupted during mobile. The separate
mobile run then passed all 90 repetitions and exited normally. Each timing case
therefore has ten consecutive passing desktop and mobile repetitions with zero
retries; the exact-commit CI reruns both together before release. These runner
interruptions produced no failed product assertions and are retained in the local
evidence rather than reported as clean combined process exits. Logs/screenshots
remain under ignored `artifacts/v0.0.11-*`. Desktop/mobile screenshots and overflow
checks cover the new editing, repair, asset-transfer and release-history surfaces.

## Expenses layout and saved-rule actions — 2 November 2026

The local-preview change keeps report filtering and financial calculations intact,
while moving the filters into a compact toolbar, placing the chart and breakdown
side by side on wide screens, and giving transactions the full width. The chart
starts with five named categories, Uncategorised and Remaining categories; pure
unit checks prove exact cent totals, refund activity, deterministic ordering and
separate positive/negative grouped stacks. The exact-value table retains every
category. Browser checks expand/collapse chart categories and the top-eight
breakdown, retain drill-down focus, and verify desktop positioning and mobile
page overflow. This replaces the old internal-breakdown-scroll assertion with
coverage for reaching every item through Show all.

Expense transaction rows reuse the existing type/category mutations and filtered
remember confirmation. The new type journey holds the save response, proves the
pending controls are disabled, then verifies that removing the source expense
from the report does not dismiss the confirmation. It checks the remaining match,
future transfer rule, balanced counterpart entries, and unchanged rows excluded
by account, date and category. The browser clock is installed before navigation;
network response waits are registered before clicks and the response barrier is
released in cleanup. Real database writes retain their integration boundary.

Saved-rule status is now the clickable row action in Transactions, account ledgers
and Expenses. The existing matching logic is shared without changing its rule
priority or eligibility. Ledger/category journeys verify the green action replaces
Remember, still opens the confirmation, survives pagination/reload and retains
mobile overflow checks. Existing transfer-rule journeys cover its linked-account
matching. Screenshots include desktop/mobile Expenses layouts and saved-rule actions.

Local checks reuse the production build and installed Chromium/WebKit, with one
worker because finance_e2e is mutable shared test state. A port-3002 test copy
changes only the localhost origin, keeping the existing preview on 5174/3000.
No household or preview database resets are used. Only affected local checks are
run; this task does not publish a release or run full local CI.

Expenses/rule-action verification passed 16 targeted unit cases, all 50 affected
desktop/mobile browser journeys, and 20 consecutive no-retry repetitions of the new
transfer timing case (10 per browser). Guardrails, lint, web typecheck, production
builds and whitespace checks passed. Screenshots were inspected for the desktop
layout, category grouping and the saved-rule action. The browser log is retained in
ignored `artifacts/expenses-redesign-browser.log`.

The subsequent compact account-card journey checks four cards per desktop row,
compact heights, stable owner colours through filtering, credit balances, archived
visibility, long names, phone overflow and opening/editing an account. The existing
account-create/open/CSV journey is rerun on both browsers. Twelve clearly labelled
sample accounts were added only to `finance_preview_0358ccf3b4`, with a display-only
invited sample member and no session/passkey/invitation grant. Stable sample IDs
and insert-only seeding preserve existing records and subsequent user edits.

Account verification passed all four desktop/mobile card and existing account/CSV
journeys. After the owner's colour refinement, the final white-card/neutral-icon
version passed both card journeys again, including ownership bubbles, editing and
mobile layout. Final screenshots were inspected; guardrails, lint, web typecheck,
web production build and whitespace checks passed. Logs are retained under ignored
`artifacts/account-cards-browser.log` and `artifacts/account-cards-final-browser.log`.
The existing local API readiness and Accounts preview returned HTTP 200 at handover.


Ownership bubbles now allocate separated hues from the full household roster,
rather than hashing each ID independently. Unit coverage checks a minimum 90-degree
hue separation for the household and two members, unique colours for larger
rosters, order independence, duplicate roster entries and the fixed Household
colour. The existing account-card browser journey also checks that the ownership
filter uses exactly the card's bubble colour. Cards, selectors, transactions and
the Expenses person breakdown share this assignment. This changes no timers or
financial behavior; earlier timing evidence remains applicable.

Ownership-colour verification passed all four colour unit cases, all ten affected
account-card, Expenses chart and ledger desktop/mobile journeys with no retries,
all workspace typechecks, lint, guardrails, shared/web builds and whitespace checks.
Final account screenshots were inspected on both browsers. The browser evidence is
in ignored `artifacts/owner-colours-browser.log`; the local preview remains ready.

## Household UX and v0.0.12 candidate — 2 November 2026

This change covers the owner-approved page-flow improvements and subsequent
refinements to the dashboard, compact filter bars, aligned chart controls,
asset/debt headers, anchored date controls and one-click category colours.
Pure shared tests own historical/forecast boundaries, refund/transfer semantics,
filter intersections and deterministic colour allocation. API integration tests
own authenticated pending-statement summaries, filter scope enforcement and atomic
colour assignment/undo, including stale-write rejection. Browser journeys own
navigation, pending/error/retry state, desktop/mobile layout and accessible controls.

The production build is reused by the local Chromium/WebKit journeys on port 3002;
5174/3000 continues serving the user's preview. No browser engines are reinstalled.
Browser tests use finance_e2e with one worker because their reset fixtures share
mutable state. API tests use the separate finance_test database and run alongside
independent static/unit checks. The category-colour test exposed category state
leaking between integration runs; the integration fixture now restores the seeded
category baseline before each test, matching E2E isolation. No preview or household
database is reset.

New coverage includes six months of recorded cash history joined to three calendar
months of existing-model forecasts, gaps before the first account, month-end/leap-day
boundaries, refunds, excluded transfers and owner-scoped spending links. UI checks
cover preserved filters/pages/Back scroll, inline budgets, planning views, grouped
net worth, asset valuation/movement explanations, import correction/status filters,
reachable action bars, retained failed edits and retry. Category-colour journeys
verify persistence across reload, every category including archived/search-hidden
items, exact undo and mobile overflow. Compact filter geometry, aligned Graph/Table
and breakdown controls, keyboard/touch tips, date-popup anchoring/collision handling,
nested calendars, Escape and outside-click cancellation are checked on both surfaces.

Timing-sensitive mutation/import journeys install the browser clock before
navigation and use response barriers with waits registered before actions. The
barriers prove pending/disabled state, then release the actual network boundary and
check successful completion or recoverable failure. Real PostgreSQL writes remain
real integration boundaries. Repetitions use zero retries and the same built bundle.

Initial browser failures identified a clipped desktop clear-date control (fixed by
letting its date button shrink beside the clear button) and test expectations for
old labels, reset-on-reload filters and modal positioning. Assertions now check the
intended retained filters, then explicitly clear them before verifying saved transfer
rows; the anchored panel may flip above its trigger on phones. A multiselect helper
now waits for the All state before choosing the requested item, preventing stale
selection reads. Existing behavior and financial assertions are retained.

The broader page run also updated legacy expectations for named multiselect
counts, retained search/page state after reload and the new Valuations tab. The
account archive checkbox uses click plus an awaited checked assertion because
React Router commits its URL-backed value in a transition; the trace confirmed
the account list and checkbox updated correctly. These corrections retain the
underlying filtering, persisted-value and financial assertions.

The mobile transfer flow then exposed a real date-filter race: the popover closed
before React Router's pending filter transition remounted the table, so an immediate
type edit could disappear. Date application and popover closure now share one React
transition. The existing end-to-end transfer journey edits immediately after the
panel closes and is included in the ten-run timing gate, along with anchored
popover/calendar interactions. These use the real browser rendering boundary,
observable draft values and closed surfaces, without arbitrary sleeps. The helper
also waits for selection menus/calendars to close before starting the next action.

R17–R19 source inspection: this release adds no runtime inputs, schema changes,
credential exposure or logging sink. The API/web image still uses the documented
root runtime example, local configuration remains separate, and the entrypoint
applies committed migrations before serving. The two new authenticated routes use
shared Zod/HttpError handling and quiet expected failures. Existing production-image
smoke checks exercise minimal inputs, placeholders, migrations, log severity,
diagnostics and redaction. Exact-candidate image/smoke/scan evidence is required in
main CI before the annotated release tag; release repeats those gates before rollout.
No live household data or registry publication substitutes for isolated verification.

Local candidate verification has passed all 132 unit cases (25 files), all 124
integration cases (24 files) and 140 affected timing repetitions (10 desktop and
10 mobile runs for each of seven save/import/transfer journeys), with zero retries.
The repeat run completed normally in 9.9 minutes. A final budget Cancel safeguard
and right alignment on wrapped chart toolbars are covered by the subsequent page
journeys; neither changes the repeated mutation/import logic. All workspace
typechecks, lint, guardrails, production builds and whitespace checks pass.
Detailed local logs are retained in ignored `artifacts/ux-final-*`,
`artifacts/ux-timing-repeat.log` and `artifacts/ux-release-web-build.log`.

Preview fixtures and manual exploration paths are documented in
[ux-preview.md](ux-preview.md). The dedicated preview had 19 accounts, 1,115
transactions and three ready sample PDF reviews at the final readiness check;
API readiness and the local frontend both returned HTTP 200. Desktop/mobile
screenshots cover filter bars, popovers, chart alignment, category colours,
account cards, grouped assets, dashboard history, import actions and editing.

The broad affected browser coverage completed 140 distinct desktop/mobile journeys
across the recorded runs, with the two existing platform-specific skips (mobile
WebAuthn registration and desktop-sidebar motion). Interrupted terminal runs were
resumed for the remaining cases; successful checks were retained. The mobile run
reported one isolated session-fixture 401 and the date-transition regression above;
the session case passed on both focused reruns without an authentication change.
After fixing the transition, all 40 additional date/transfer repetitions passed
(ten per case per browser, zero retries) in 5.7 minutes. The final desktop and
phone screenshots were inspected, including anchored/flipped date panels, aligned
chart controls and visibly separated asset/debt totals. Evidence is retained in
`artifacts/ux-affected-browser.log`, `artifacts/ux-browser-finish.log`,
`artifacts/ux-mobile-recovery.log` and `artifacts/ux-date-final.log`.

The post-fix 48-journey filter suite passed 47 cases and identified one remaining
test-helper race between a preset click and opening the next date field. The preset
helper now waits for the panel to close (different presets can represent identical
dates, so readiness uses expanded state rather than a particular label). The
affected Expenses chart/pagination journey then passed ten consecutive desktop and
ten mobile runs without retries in 2.9 minutes, recorded in
`artifacts/ux-period-helper-repeat.log`. All affected journeys consequently have
passing evidence; no local failure remains unresolved. Final web typecheck, lint,
guardrails, web build and whitespace checks pass. Exact committed-candidate full CI,
image verification and release/deployment checks follow publication to main.

Main CI run 41354491263 exposed a further test-readiness race in the final account
filter assertion of automatic transfer remembering. A local repetition reproduced
the strict locator matching both correctly saved transfer counterparts before the
filter committed. The multiselect helper now awaits the selected option's checked
state before closing, and the test waits for one scoped row before asserting its
saved type. No financial behavior or assertion is removed. CI now runs 260 timing
repetitions and 178 browser cases with the existing single database worker; the
observed live run took about 14 minutes to reach the mobile timing cases. Its job
allowance increases from 45 to 60 minutes to leave room for full browser coverage,
the production image, smoke checks and scanning. All validation gates remain.

The filter-helper follow-up passed all 40 transfer timing repetitions (ten of each
case per browser, zero retries), followed by all 22 affected account, Expenses,
inline-category and Uncategorised-filter journeys on desktop and mobile. Evidence:
`artifacts/ux-filter-helper.log`. Guardrails, lint and whitespace checks pass; this
follow-up changes test readiness and CI time allowance only, so the application
typecheck, unit, integration and production-build evidence above remains valid.

Main CI run 41356486333 passed 132 unit tests, 124 integration tests and all 260
timing repetitions, then completed the full browser suite with 174 passed, three
platform skips and one desktop date-reset timeout. Its log identifies the next
`To date` click racing the previous `Apply dates` transition: the old picker was
visible when inspected, then detached before the click. The test now awaits panel
closure and restoration of all four expected rows after each manual date clear.
All 20 focused repetitions passed (ten per browser, zero retries) in 2.0 minutes;
evidence is in `artifacts/ux-date-reset-repeat.log`. All eight affected category
journeys then passed on desktop/mobile (`artifacts/ux-date-reset-suite.log`), along
with guardrails, lint and whitespace checks. Application code is unchanged.

## Overview month and compact report headings — 3 November 2026

The shared finance test owns full prior-month boundaries, exact refunds, transfer
exclusion, owner filtering, month-specific budgets and unchanged current balances.
`overview-month.spec.ts` owns month selection, ownership preservation, reloads,
transaction/budget drill-down dates, invalid/future URL fallback, desktop header
alignment, mobile overflow and the relocated expense controls. Existing Overview
history, expense chart, detail and category journeys retain their assertions.

Verification uses the existing production build on port 3002 and only
`finance_e2e`, leaving the owner's development app and finance database available.
A temporary harness changes hard-coded test origins from 3000 to 3002; it preserves
all tests and assertions. One worker remains necessary because these journeys
reset the same isolated database. Unit tests and static checks run independently.
No timeout, debounce, polling or retry timing changed, so no new timing-repeat
selection applies. All waits use rendered state or real API/database completion.

Results on Node 24.21.0/pnpm 10.34.6: 32 focused unit cases in finance,
overview-history, expenses and expense-category-trend passed; all workspace
typechecks, changed-file ESLint, guardrails and shared/API/web builds passed.
The affected browser selection covered 16 distinct desktop/mobile cases. Fourteen
passed initially; two caught the changed current-month caption. Restoring
"Income this month" for the default month resolved that regression, and all four
month/category follow-up cases passed without retries (50.3 seconds;
`/tmp/finance-overview-final-browser.log`). Unaffected chart/history evidence was
reused. Desktop and mobile Overview/Expenses screenshots were visually inspected.
Full GitHub CI and a release were not requested or run for this local change.

## Custom calendars, budget periods and budget reporting — 3 November 2026

The shared budget model now owns finite repeat periods, effective monthly overrides
and budget-versus-actual reports. Coverage includes inclusive year boundaries,
one-month budgets, old ongoing plans, overlapping active plans, zero overrides,
first-month edits, restoring a plan, shortened plans retaining explicit overrides,
refunds, exact cents, unbudgeted categories, subcategory isolation, matched/cancelled
bills and current/past/future report cutoffs. The owner's $200 subscription example
is explicitly covered: $150 scheduled plus $50 unused allowance, or the full $230
when known bills exceed that budget. Report actuals remain separate from future bills.

The new budget API integration suite plus finance and ledger-category regressions
passed 19 cases against finance_test. This includes persistence, authentication,
invalid repeat ranges, invalid categories, idempotent restore and competing monthly
overrides. The additive migration was applied successfully to the local household
schema and isolated databases; existing budget rows keep their amounts and unlimited
duration. No household database was reset.

Calendar keyboard selection/dismissal and focus restoration passed ten consecutive
runs per case on both desktop Chromium and mobile WebKit: 40 passes, zero retries.
The affected existing calendar/planning/overview/transaction/asset/filter/statement
journeys passed 42 cases. After adding reporting, all eight selected budget/report
browser cases passed, including under/over and unbudgeted filters, six-month table
navigation, refund-inclusive transaction drill-downs, retained month when editing,
repeat counts and failed override retry. No assertion/timeout was relaxed. A mobile
bill action row overflow found in the new date journey was corrected with wrapping;
the calendar was widened on desktop and uses the existing dialog surface on phones.

The browser harness reused the production build on port 3002 so the local preview
could stay available. It used finance_e2e with one worker because fixtures reset a
shared test household. Existing test copies with fixed Origin headers were adjusted
only in /tmp to use that port. Native engines/libraries were reused, and independent
unit/type/lint checks ran separately from this single mutable fixture resource.
No arbitrary sleeps were added. Chart/report interactions have no new timer windows.

The separate finance_demo database was prepared with 193 fictional transactions,
eight budget plans, seven schedules and six months of history. Re-running preparation
left the dataset intact. A temporary signed demo session verified the live API totals,
$200/$50/$100/$50 subscription budget/actual/upcoming/available example, six trend
months, demo banner and desktop/mobile overflow; that temporary session was removed.
Screenshots of both calendars, budgets, reports and the populated demo were inspected.
The normal local finance records were only read for sign-in continuity; fixture
financial data was written solely to finance_demo. Provider credentials are disabled
in the demo process, and pnpm dev returns to the unchanged regular configuration.

The reporting presentation follow-up has a dedicated /budget-report route, desktop
sidebar entry and mobile More entry. Browser coverage verifies active navigation,
retained months from existing report links, compact meter geometry, the 100% marker
at two-thirds of the track, green 0%/70%/100%, red 150%/160%, capped overflow, zero
allowances, unbudgeted rows and shortfalls caused solely by upcoming bills. The
report, budget-plan and sidebar selection passed 11 cases with zero retries in
1.1 minutes; the desktop-only sidebar motion case was intentionally skipped on
mobile. Its compositor implementation is unchanged. No timing-sensitive control
changed after the ten-run calendar evidence above.

Final local verification: all 147 unit tests, all workspace typechecks, full ESLint,
source/file-size guardrails, whitespace checks and shared/API/web production builds
passed. The live demo was checked again on desktop Chromium and mobile WebKit;
both screenshots were visually inspected and neither had horizontal overflow.
The demo remains running at http://localhost:5173/budget-report with six months of
fictional finances. This task did not publish a release or run remote CI.

### v0.0.13 release candidate — 3 November 2026

The owner subsequently requested faint report-column separators and release
v0.0.13. Root/API/web/shared versions and in-app release highlights now agree.
The final report suite passed all four desktop/mobile cases without retries
(21.5 seconds), using the rebuilt production bundle and isolated finance_e2e.
Both demo surfaces were checked again; desktop separators preserve alignment
and the mobile figures retain their stacked layout. Full lint, all workspace
typechecks, guardrails, whitespace checks, shared/API/web builds and the deployment
script test passed. Earlier financial unit/integration and calendar timing evidence
above remains applicable; this follow-up changes presentation and release metadata.
Main-branch CI and release-image validation run before publication under the existing
workflow; no check is bypassed. The additive budget migration preserves historical
plans and is applied automatically by the production entrypoint.

Main Validate [41516369900](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/41516369900)
on `b33f47394cf919d36a2e00023f31807cbfff4f27` passed 147 unit tests, 130 API
integration tests and all 260 timing repetitions. Its full browser suite passed
191 cases, skipped three inapplicable cases and found two failures before image
validation/publication. The desktop layout assertion still required neighbouring
cards' controls to share a row, despite the requested title-row layout and responsive
wrapping. It now verifies each control group's exact right edge, title alignment or
compact wrapping, bounds and ordering, retaining the tooltip and overflow checks.

The mobile 800-record ledger journey exhausted its unchanged 30-second test budget
after successful preview, cancellation, save and reopening actions. Trace evidence
showed accumulated browser/database work rather than a failed financial assertion.
The journey is split at persisted category/rule boundaries: the first case checks
the real inline category edit, 800-match preview, cancellation and reload; the second
performs the real 800-record save and checks its rule, records and saved-action UI;
the third starts from an equivalent isolated saved-rule fixture and retains pagination,
reload, match-count, action, rule-navigation and screenshot checks. Both desktop
and mobile coverage and the 30-second threshold remain. Each case resets its own
fixture; one worker still owns finance_e2e. No sleeps, retries or waived checks were
introduced. These test-only corrections have no user-guide impact.

The final three ledger cases passed ten consecutive runs on each engine: 60 passes,
zero retries, one worker, 10.1 minutes. Maximum individual duration was 16.5 seconds
on desktop and 18.4 seconds on mobile. The complete affected ledger/UI-polish suite
then passed all 14 desktop/mobile cases in 1.6 minutes. Both runs reused the existing
production build on port 3002 and only finance_e2e. Final guardrails, ESLint and
whitespace checks passed; application sources and the previously checked production
bundle were unchanged by these test corrections.

## HSBC grouped statements — 8 November 2026

`hsbc.test.ts` owns column signs, blank posting dates, cross-page descriptions,
New Year, overdrafts, source provenance, malformed amount rejection, multiple
accounts/currencies and printed balance/total/count reconciliation. Its fixture
contains fictional transactions and is extracted through real Poppler.
`ai-reader.test.ts` proves omitted HSBC rows survive partial AI output and that
invented dates/signs/footer rows cannot replace deterministic source evidence.
Shared date tests retain the posting date ahead of dates inside descriptions.

`hsbc-statements.integration.test.ts` owns real PDF upload, durable replacement
of a partial saved review, atomic/idempotent import, source amount/date protection,
refund preservation and inherited-date correction through the real API/database.
The existing statement, bank-layout, job and date integration suites remain intact.
`hsbc-statement.spec.ts` owns upload/review/reload/import, cross-page descriptions,
displayed posting dates, final account balance and overflow on desktop/mobile.

Focused local checks on Node 24.21.0 / pnpm 10.34.6 passed 52 unit cases across
statement readers, shared dates and import review, and 25 database integration
cases across the five statement/HSBC suites. Units use four workers on this
20-CPU host; integration uses the existing single-worker `finance_test` fixture
because it resets shared records. They ran independently. OCR checks reuse the
installed local Docker Tesseract wrapper; initial sandbox/runtime failures were
resolved by allowing local service access, without skipping OCR assertions.
All workspace typechecks, focused ESLint, guardrails and production builds passed.

The supplied ten-page household statement was checked locally without uploading it
to an AI service or changing household records. The old reader produced 41 rows.
The new full extraction pipeline produces 149 rows: 72 debits and 77 credits,
matching the bank's printed counts and debit/credit totals. An independent
decimal-arithmetic reference matched every row's posting date, signed amount,
page and source line, all 41 running-balance checkpoints and the closing balance.
There are no parser errors, unmatched transaction lines or reconciliation warnings.
Regression fixtures contain only fictional data; the private PDF and extracted
data stay outside the repository.

Browser checks reuse the production build on port 3002 and `finance_e2e`, with one
worker because journeys reset the same household fixture. The regular development
server and household database remain untouched. A temporary harness changes only
test origins to port 3002; existing Chromium/WebKit engines and native dependencies
are reused. Backend PDF/database completion uses observable readiness. No timeout,
retry or debounce behaviour changed. The affected missing-year recovery journey
passed ten consecutive runs per engine with retries disabled: 20 passes in
3.0 minutes (`artifacts/hsbc-date-repeats.log`). The complete selected files
`hsbc-statement.spec.ts`, `statement-date-recovery.spec.ts`,
`statement-reread.spec.ts` and `statements.spec.ts` then passed all 16 journeys
on both engines in 2.2 minutes (`artifacts/hsbc-browser-suite.log`). Desktop/mobile
HSBC review screenshots were visually inspected. Formatting and whitespace
checks also pass. These are focused local working-tree results; no full GitHub
CI, new production image, release, publication or deployment is claimed.

### Account import history, saved-rule recovery and account spending — 8 November 2026

Scope: newest recorded transaction dates on cards, account details and import
screens; current saved-rule suggestions in new entries and CSV/PDF reviews;
reviewed bulk application to existing uncategorised records; and account-only
spending/category drill-downs. The latter reproduced an obsolete `accountId`
filter at the call site while the report requires `accountIds`. The regression
fixture includes both uncategorised and same-category spending in another account.

Focused units passed 46 cases across 11 shared/web files with four workers.
Database checks passed 51 cases across eight integration files: category-rule
application, date repair/saved reviews, remembered categories, finance, HSBC,
CSV, reconciliations and remembered transfers. Stale transactions/rules/categories/
accounts, explicit choices, exact-rule precedence, refunds, transfer exclusion,
reviewed-ID boundaries, atomic rejection and source date/amount protections are
covered. A new test initially compared the automatic `updatedAt` timestamp as a
ledger fact; its expectation now permits that timestamp while checking every
other field. The corrected suite passes. All workspace typechecks, focused lint,
source/file guardrails and production builds pass.

Checks use Node 24.21.0 / pnpm 10.34.6, isolated `finance_test` and `finance_e2e`,
and the existing port-3002 browser harness. Unit and independent database/browser
checks run concurrently; each database fixture retains one worker because its
reset is shared. Browser engines and compiled output are reused. The user guide
explains latest dates, explicit rule choices, recovery from stale bulk matches,
and the account boundary. No household records, schema or release identity change.

## Category slicer Select all — 8 November 2026

`category-select-all.spec.ts` covers Transactions, account ledgers and Expenses on
both desktop Chromium and mobile WebKit: keyboard activation, every option ticked
(including archived categories and Uncategorised), keeping the menu open, excluding
one child while its parent stays ticked, reload persistence, selecting all again,
clearing and restoring ordinary parent/subcategory behaviour. Menu bounds and
screenshots cover small-screen layout. Shared expense units own exact-category
exclusion and refund totals; the real API/database case in
`expense-categories.integration.test.ts` rejects an excluded child's ID and keeps
it unchanged when remembering visible matches.

The checks use Node 24.21.0 / pnpm 10.34.6. Browser verification uses port 3107 and a
separate `category_slicer_20261108` schema in isolated `finance_e2e`, with its own
environment file, to preserve the existing local test preview on port 3002. One
browser worker remains necessary for shared fixture resets within that schema.
API checks use `finance_test`; independent units, static checks and API checks run
concurrently. Existing compiled output and installed engines are reused. These
interactions introduce no browser-owned deadlines or timing-wait conversions;
assertions use rendered state and completion, without sleeps or retries.

Verification passed: all workspace typechecks, production shared/API/web builds,
source/file guardrails, changed-file ESLint and whitespace checks; 22 focused unit
cases (`expenses`, `expense-category-trend`, `transaction-rules`, `chart-groups`);
5 API/database cases (`expense-categories`, `ui-flow`); and 12 browser cases across
both projects (`category-select-all`, `expense-filters`, `uncategorised-filters`).
The first new browser run incorrectly queried the trigger while Radix hid the
background from accessibility queries. Moving that text assertion until after
Escape corrected the test; all six new cases then passed in 52.2 seconds, with
retries disabled. The six existing cases passed against the same application build.
Desktop/mobile screenshots of all three category menus were inspected. Full GitHub
CI, a commit, publication and deployment are not claimed for this local change.

The initial desktop/mobile pass completed all 24 selected journeys (2.7 minutes).
The affected timing flows—CSV AI batch recovery, remembering PDF categories across
pages, and PDF date repair—then each passed ten consecutive runs on both Chromium
and WebKit with retries disabled: 60 passes in 9.0 minutes
(`artifacts/account-rule-timing-repeats.log`). Existing browser clocks and response
barriers remain; PDF extraction and database readiness still use real observable
completion. Desktop/mobile screenshots of the account dates and saved-rule review
were visually inspected, with no horizontal overflow.

The final affected suite then passed all 46 journeys on desktop Chromium and
mobile WebKit in 5.0 minutes, with retries disabled
(`artifacts/account-rule-browser-suite.log`). Files: account cards/insights,
category rules, saved-rule application, CSV AI/import, remembered categories,
HSBC statements, date recovery, rereading and the statement/account journeys.
The chart regression verifies that another account's uncategorised and grocery
spending appears in neither the account bars nor the category drill-down, while
refunds, transfers and balance figures remain correct. These are focused local
working-tree results, not a full CI, image, release or deployment assessment.

Candidate boundary: the browser server reused the production build prepared for
this task. During verification, separate account-branding/schema and category-filter
work appeared in the shared checkout, including later edits to AccountCard and its
fixtures. Those edits were preserved; the latest-date props, saved-rule route and
accountIds spending fix remain present. The results above do not certify the
subsequently combined working tree or its new branding/migration work. That work
needs its own rebuilt-candidate verification; this task did not release or deploy.


## Institution branding and soft account cards — 8 November 2026

Scope: nine bundled institution presets, exact-name recognition, per-account
appearance overrides, bounded PNG logo persistence, reusable custom institutions,
soft-tinted cards, amount-owed labels and retained last-transaction/owner behaviour.
Verification used Node 24.21.0 / pnpm 10.34.6 on the local worktree based on
`8148f084a8ebfd6e5e21b30163b95e4889f67533`, including the pre-existing uncommitted
account/import/category changes. No household database reset, release or deployment
was performed. Migration checks used only finance_test and finance_e2e.

Coverage ownership:

- Shared `institutions.test.ts` owns exact aliases, unknown/cash fallback, icon/logo
  precedence, per-account override isolation and rejecting executable URLs, SVGs,
  arbitrary CSS, oversized logo strings and unsupported presets. Existing account
  and finance units retain exact-cent ledger semantics.
- `account-branding.integration.test.ts` owns authenticated member persistence,
  reusable institution creation plus account save atomicity, duplicate-name rollback,
  invalid relations, PNG signature/dimension checks, preserved omitted overrides and
  round-tripping existing null appearance while correcting opening dates. Finance,
  UI-flow, statements and asset-transfer integration tests protect surrounding routes.
- `account-branding.spec.ts` owns existing-name recognition, restore defaults,
  persisted edits, PNG conversion, invalid-file recovery, held save-pending state,
  save failure preserving inputs, explicit retry and reuse on another account.
  `account-cards.spec.ts` retains owner-colour consistency, filtering/archival,
  last-transaction dates, long names, detail editing and no horizontal overflow.
  The approved taller branded layout replaces the earlier 180/200px compact-card
  limits with a 280px maximum; four desktop columns and single-column mobile
  checks remain. Credit debt now asserts the explicit Amount owed label plus its
  positive displayed magnitude; ledger/combined balances stay signed.

One browser worker remains necessary because both projects reset finance_e2e. API
checks use separate finance_test; types, lint and pure units ran independently.
Real browser image decoding and API/database completion use observable readiness.
A response barrier is installed before save, asserts pending, then releases the
503 response; no timeout, debounce or scheduled retry is introduced. No arbitrary
sleeps, retries, new browser installs or rebuilt E2E server setup were used.

Local verification results:

- `pnpm guardrails`, affected-file ESLint, all three workspace typechecks,
  `git diff --check` and `pnpm build`: passed.
- Selected units: institutions, accounts and finance — 22 tests passed.
- Selected real API/database integration: account-branding, finance, ui-flow,
  statements and asset-transfers — 31 tests passed.
- Ten sequential invocations of `playwright test e2e/account-branding.spec.ts
  --retries=0`, desktop Chromium and mobile WebKit, one worker: 10/10 passes,
  40 checks total, approximately 26–27 seconds per invocation. Logs are ignored
  `artifacts/account-branding-run-1.log` through `-10.log`. The same built output
  was reused. The host uses the existing `/tmp/finance-csv-webkit.sh` native-library
  launcher; no project/browser configuration was changed.
- Desktop/mobile account and Appearance screenshots inspected; all nine bundled
  logo files decode/parse, and SVGs contain no scripts or external images.

Verified build identity: API account service SHA-256
`e84fd2335fa6f7da430d54101c9f281de71ef2b6abe5e37fd52b18c2944c72ab`;
Accounts chunk `Accounts-Ne6PV9UO.js`, AccountForm chunk `AccountForm-CLoCal9n.js`.
These are focused local checks, not full GitHub CI or production-image/readiness
certification. No version or release notes change is required before a release is
requested.

Final affected browser suite: `playwright test e2e/account-branding.spec.ts
e2e/account-cards.spec.ts e2e/account-insights.spec.ts e2e/statements.spec.ts
e2e/statement-date-recovery.spec.ts --retries=0` — all 22 desktop/mobile checks
passed in 2.4 minutes after the ten-run streak. The same production build was used;
all nine local institution assets also match the files packaged into that build.


## Qantas Pay AUD statement reader — 8 November 2026

Scope: Qantas prepaid statement columns, currency selection, wrapped merchants,
cross-page amounts, full dates across New Year, refund/reload suggestions and
unmatched settlement warnings. The supplied PDF was checked locally read-only
through the actual reader: all 23 identifiable transactions are retained and
one undated monetary line remains highlighted. Household data is not committed
as a fixture or sent to an AI provider.

Coverage ownership:

- Parser units use a synthetic three-page PDF through real Poppler. They own
  exact cents/dates, balance currencies, continuation lines, malformed amounts,
  ambiguous/missing/foreign wallet values, conflicting signs, refunds and reloads.
- The mocked AI provider case owns preservation of every verified source row,
  signed wallet amounts, source descriptions, refund category eligibility,
  category-free transfers and refusal to invent an undated payment.
- Real API/database tests own durable previews, rereading an old partial review,
  source date/amount tampering, atomic approval, refund persistence, paired
  reload transfers, idempotency and warnings surviving a reload.
- Desktop/mobile browser journeys own upload, opening balance, source notes,
  incomplete-entry recovery controls, merchant/refund display, funding-account
  choice and a complete import. No new timer, debounce or timeout is introduced.
  Real PDF worker/database completion uses observable readiness.

Focused local checks use Node 24.21.0 / pnpm 10.34.6 on the worktree based on
`8148f084a8ebfd6e5e21b30163b95e4889f67533`. Unrelated in-progress UI/schema work
is preserved. Statement units (all module test files plus shared statement dates):
54 passed. The six affected integration files (Qantas, HSBC, statements, jobs,
bank statements and dates): 28 passed in 29.82 seconds. Final integration uses
only schema `qantas_reader_20261108` in finance_test. Guardrails, affected ESLint,
API/shared/web typechecks and the production build passed. A transient web
typecheck failure in concurrent category/schedule work cleared on recheck; those
files were not modified for this fix.

Browser validation uses a temporary harness at `/tmp/finance-qantas-e2e`, port
3109 and task-specific schemas in finance_e2e because the regular
preview port is occupied. The harness changes only test origins/paths and server
binding; assertions and timeouts remain. Both existing Chromium and WebKit engines
are reused with `/tmp/finance-csv-webkit.sh`. One browser worker remains necessary
within this schema because each journey resets it. Database integration and
independent static/unit checks can run alongside the browser checks. The existing
production build is reused. An initial source-notes locator selected a hidden
paragraph; it was corrected to target the visible disclosure without weakening
assertions or extending timeouts.

Verified reader build SHA-256: Qantas module
`b9bdb65a641750baae30a7d842b5b204ebcc6e60875d8d8778e090813708432d`;
AI reader `c3ac9f3b3472eaed1e0822774afeacbb4db925c25baa2b490ba22d618e782e20`.
No configuration or logging sink changes apply: source inspection retains quiet
expected validation failures and existing worker error redaction. This is focused
local verification, not full CI, production-image R17–R19 certification, release
or deployment evidence.

The four new Qantas desktop/mobile journeys passed in 43.5 seconds after the
source-notes locator correction. Desktop source-note and mobile transfer-review
screenshots were inspected, including no horizontal overflow. A later rerun
encountered a concurrent rename of another task's visual-identity migration:
the test schema had already applied the same columns under the earlier name.
No application change or household database was involved. Stability verification
therefore uses fresh schema `qantas_reader_20261108_v3`, migrated once, with
compatible setup reused for subsequent invocations. The previous failed schema
is unused; no migration history was rewritten.

Saved-review timing recovery: ten sequential invocations of
`playwright test e2e/statement-reread.spec.ts --retries=0` passed on desktop
Chromium and mobile WebKit, one worker (20 checks total). Logs:
`/tmp/finance-qantas-e2e/artifacts/reread-1.log` through `reread-10.log`.
Existing browser-clock and response-barrier assertions are unchanged. The final
affected statement suite follows the streak using the same build/setup.

The affected browser suite passed all 20 desktop/mobile checks in 3.3 minutes
with retries disabled: Qantas, HSBC, statement dates, saved rereading and the
statement/account journeys. Log:
`/tmp/finance-qantas-e2e/artifacts/final-statement-suite.log`.

Final review added a narrow fail-closed guard for a recognised Qantas layout
with no complete AUD transactions: it returns export/retry guidance instead of
falling through to generic OCR/AI. A provider regression verifies that no AI
request is made for a foreign-only wallet. The complete affected unit/OCR
selection then passed 56 cases, the API was rebuilt, and the supplied PDF passed
the compiled reader again (3 pages, 23 complete source rows). Final Qantas build
SHA-256 is `2b87611922e36942e249a9dbf0349cd59c4ab41109264e19bcff5deb8fffb612`;
the AI reader hash is unchanged. The existing broader browser results cover the
unchanged generic/HSBC paths; Qantas desktop/mobile checks are repeated against
this last build. No timer or recovery-control behaviour changed in that guard.

Final rebuilt-reader Qantas browser rerun: all four desktop/mobile cases passed
in 48.8 seconds, retries disabled, same isolated setup. Log:
`/tmp/finance-qantas-e2e/artifacts/qantas-final-guard.log`. The final highlighted
orphan-source screenshot was inspected. Final affected lint, guardrails and
diff-whitespace checks pass. Temporary environment files containing test session
secrets are removed after verification; logs and synthetic screenshots remain.

## Visual consistency and calendar-year dashboard — 8 November 2026

Scope: institution identity across selectors/detail/imports; persisted category
icons and schedule icons/colours; tinted overview, budget, forecast and net-worth
summaries; asset identity; compact mobile filters, visible active selections and
clear controls; import progress; loading/empty states and the mobile account
form's sticky Save button. The year shortcut uses calendar year to date and net
income; monthly budgets remain monthly. Top categories and drill-down dates
follow the selected period; available balance stays current.

Validation used Node 24.21.0 / pnpm 10.34.6 and the existing build server. API
checks used finance_test, browser checks finance_e2e, and only additive migrations
were applied to finance_demo. Existing demo records were preserved; the real
finance database was not reset or migrated. The initial renamed migration failed
because the original migration had already run in finance_test; restoring its
original identity and marking only the failed duplicate attempt rolled back
recovered the test setup without deleting data or changing schema history in the
real database.

- Shared period/icon tests cover January boundaries, leap February, historical
  month end, today cutoffs, owner selection, refunds, transfer exclusion, current
  balances and explicit/inherited/default icons.
- `pnpm test`: 203 passed. The first run lacked host Tesseract; rerunning with
  `PATH=/tmp/finance-ocr-bin:$PATH` used the pre-existing OCR container wrapper and
  passed all tests, including real PDF/scan extraction.
- Focused API integration: 17 passed across visual-identity, finance,
  account-branding and expense-categories. New appearance fields survive snapshot
  reload, preserve omitted fields from older clients, support null resets and
  reject invalid icon/colour values.
- Broad desktop/mobile regression: 69/70 initially passed across 15 files. The
  remaining assertion exposed the account form's nested fieldset bypassing the
  existing sticky-submit selector. Extending that selector restored visible Save
  on mobile without weakening the test. Final ui-polish, ux-flow and
  visual-refresh journeys then passed 18/18, including that assertion and the
  appearance reset staying unsaved until Save is pressed.
- Browser screenshots under `artifacts/visual-*.png` cover Overview, transactions,
  expenses, account detail, CSV/PDF import, schedule appearance, assets, net worth
  and Settings on desktop/mobile. Screenshots were visually inspected; overflow
  assertions are retained. Long mobile pages use CSS-scale captures rather than
  exceeding WebKit's bitmap size limit.
- Production build, all workspace typechecks, repository lint, guardrails and
  `git diff --check` passed. No release, deployment or full readiness decision is
  claimed by this visual change.

Browser tests retain one worker because their reset fixtures share finance_e2e.
Independent unit/API verification ran alongside browser checks on separate data.
New tests wait for visible state and completed saves; no arbitrary sleeps were
introduced. Filter helpers reveal the mobile panel before choosing a hidden
control, preserving their selection, date, focus and recovery assertions.

The affected date-popover and inline-category pending/recovery tests subsequently
passed ten consecutive repetitions per desktop/mobile project with retries
explicitly disabled: **40/40 passed**. Command: `FINANCE_WEBKIT_EXECUTABLE=/tmp/finance-csv-webkit.sh mise exec -- pnpm exec playwright test e2e/ui-polish.spec.ts e2e/transaction-categories.spec.ts --grep '@timing' --repeat-each=10 --retries=0`.
The full affected `ui-polish.spec.ts` and `transaction-categories.spec.ts` suites
then passed **14/14** on the same build, with retries disabled. Final local demo
startup uses `BETTER_AUTH_URL=http://localhost:5174 mise exec -- pnpm dev:demo`;
it retains the separate finance_demo database and existing admin login boundary.
Manual preview: signed in as Demo Admin at localhost:5174; verified populated
month totals, then selected This year and confirmed the year-to-date label,
net-income card and January-to-today category drill-down URLs. The current
balance remained unchanged. `artifacts/visual-demo-overview.png` records the
signed-in preview left open for the owner.


## v0.0.14 release candidate — 8 November 2026

Release scope combines the already documented institution/visual/period changes
with pending HSBC/Qantas readers, saved-rule recovery and category selection.
Root/API/web/shared manifests and in-app release highlights agree on 0.0.14.
The existing desktop/mobile screenshots and timing repetition evidence above
cover the unchanged application candidate; release metadata introduces no new UI.

Focused pre-commit verification on Node 24.21.0 / pnpm 10.34.6 passed guardrails,
repository ESLint, all workspace typechecks and whitespace checks. Eleven selected
unit files passed 69 tests (periods, branding, accounts, import rules, statement
dates, expenses, demo policy and statement providers). Ten isolated finance_test
API files passed 43 tests: access, account branding, saved-rule application, demo
sessions, expense categories, HSBC, Qantas, statement dates, visual identity and
diagnostics. Logs are `/tmp/finance-release-unit.log` and
`/tmp/finance-release-integration.log`. Existing test fixtures retain their
sequential shared-database group; independent unit/static verification ran in
parallel. No household/demo data was reset.

R17/R18 inspection found no changed production inputs: the single API/webapp
service still owns root `.env.example` with runtime-only database/auth/optional
provider inputs; local `.env.local.example` remains separate and Docker excludes
real environment files. The development-only demo flag is launcher-owned, not
a deployment input. R19 retains quiet auth/validation paths, disabled Better Auth
logging and safe SIGUSR2 diagnostics; focused diagnostics/access tests passed.
Both migrations only add nullable appearance fields and the institution table.
The existing production-image smoke suite exercises migrations, durable data/setup,
configuration, metadata, log silence, diagnostics and redacted genuine failures.
It now also asserts the production access status disables demo login and the
demo endpoint returns 404. Exact-candidate image smoke/scan evidence and complete
application validation are required in GitHub before tagging/publication.
