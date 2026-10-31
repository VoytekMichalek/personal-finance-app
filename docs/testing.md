# Testing

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
