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
