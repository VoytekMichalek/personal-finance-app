# Implementation verification — 2026-10-03

Candidate: unreleased local working tree in VoytekMichalek/personal-finance-app. This is implementation verification, separate from the initial Unverified R01–R19 assessment. No registry publication, live deployment or production backup has been performed.

## Evidence and limits

The shared calculation/parser/provider suite covers integer AUD cents, refunds, neutral transfers, owner filters, category-budget boundaries, anchored recurrence, matched occurrences, today's unrecorded bills, forecast double counting and recorded valuation history. API suites use real PostgreSQL for access, bootstrap/invite expiry/revocation, last-admin/passkey protection, signed sessions, concurrent edits, atomic imports, retained duplicate source rows, repayments/refunds, private receipts and recovery after storage failures.

Chromium uses actual Better Auth/WebAuthn with a virtual authenticator for first-admin setup, spouse enrolment, sign-in and logout. Both desktop Chromium and mobile WebKit cover the real account/import/budget/net-worth/schedule/forecast journeys. Keyboard focus and receipt previews/download/recovery are exercised on both surfaces. Receipt storage responses in browser tests are explicit UI fixtures; authenticated storage operations and failure compensation are API integration cases. Live account/bucket access remains a separate check.

Timing-sensitive CSV tests hold a response before upload and prove pending/recovery states with observable readiness. Ten consecutive runs with retries disabled are required per browser. No arbitrary sleeps or retry masking are used. Browser runs and image builds are sequential because competing local memory/I/O produced a measured deadline failure. Earlier failures also caught Safari's local HTTP upgrade policy, generated-client packaging and a shared import limiter; those were fixed before final verification.

The single production image runs as non-root, includes the frontend/user guide, generates Prisma in its target runtime and applies committed migrations before readiness. Disposable database/image checks verify fresh/current startup, migration failure, insecure runtime configuration rejection, quiet polls, auth denials and secret redaction. The runtime has no npm installation; dependencies are installed only during build. Trivy scans high/critical findings and CI blocks publication on failures.

Dependency age resolution is 48 hours. A patched deepmerge-ts override removes the audited Prisma transitive vulnerability; Prisma generation/migrations and image startup verify compatibility. No accepted-risk exception or scan suppression is configured.

## External checks still pending

- Voytek will populate ignored `.env` with OpenRouter and private R2 credentials, restart the API, select an approved model and run `pnpm integrations:verify`. Both synthetic provider round trips remain unverified until those credentials exist.
- GitHub CI/release workflows are supplied but have not run remotely: this work has not been pushed, tagged or published. Observe authorised push CI before claiming complete SOP instantiation.
- Manual production provisioning, deployment, backup/restore rehearsal and the scoped pre-deployment assessment remain separate, authorised operator actions.

## Final local results

All results below are from 2026-10-03, with retries disabled. No maintainer waiver or scan suppression was needed.

| Check | Outcome |
| --- | --- |
| Frozen-lockfile installation and target build | Passed in a fresh Docker build context |
| `pnpm ci:prepare` | Shared schema compilation and Prisma generation passed |
| `pnpm guardrails`, `pnpm lint`, `pnpm typecheck` | Passed for the repository and all three workspaces |
| `pnpm test` | 22 tests passed across three files |
| `pnpm test:integration` | 23 tests passed across three files using isolated real PostgreSQL |
| `pnpm audit --audit-level=high` | No known vulnerabilities found |
| `pnpm build` | Shared, API and frontend builds passed |
| CSV response-barrier repeat | 10 consecutive passes in Chromium and 10 in mobile WebKit, no retries |
| Keyboard focus repeat | 10 consecutive passes per browser, no retries |
| Full browser suite | 13 passed; one mobile virtual-authenticator case intentionally skipped because CDP automation is Chromium-specific |
| Screenshot review | Desktop and mobile reviewed; no horizontal overflow; mobile financial totals use two columns |
| `pnpm ci:smoke` | Fresh/current migrations, failure before readiness, non-root runtime, frontend, auth, configuration, redaction and quiet-poll checks passed |
| Trivy 0.75.0 image scan | Zero high/critical findings across 20 Alpine packages and 240 detected Node packages |

The browser suite includes real desktop first-admin/spouse passkey enrolment, sign-in/logout, accounts, reviewed CSV imports, budgets, schedules, forecasts, historical net worth, keyboard forms, expense/refund/transfer reconciliation, and receipt preview/download/retry behaviour. Mobile financial and receipt journeys passed in WebKit. Native mobile passkey enrolment still requires the users' real devices.

### Candidate identity

- Local image: `personal-finance:verification`.
- Image/scan identity: `sha256:7e840486fe693175e94af519887dda3fa396afb91758de0c436a36a5be529615`.
- Runtime metadata: version `0.1.0`, release tag `unreleased`, build commit `working-tree`, build time `2026-10-03T06:08:27.488Z`.
- Base runtime: Node 24.21.0, Alpine 3.24.2. The image's application dependency versions match the root lockfile; base-image tools and the generated Prisma client are separate inventory entries.
- Maintained candidate SHA-256: `e962aba02a798cb97a47ed896d2f7ee979cff6b702c936581918fac5cc5c7374`, covering 106 files under apps, packages, scripts, e2e, workflows, the packaged user guide, and root build/test/toolchain manifests. Generated outputs, installed dependencies, artifacts and local secrets are excluded.
- Ignored local evidence: `artifacts/image-scan.json`, `artifacts/verification-candidate.json`, `artifacts/overview-desktop.png` and `artifacts/overview-mobile.png`.

These identities describe the unreleased local candidate. There is no remote CI result or published registry digest, and live provider verification remains pending as listed above.

### Browser environment

Local WebKit used the official Playwright engine with three missing host libraries extracted into `/tmp/finance-browser-libs`, plus `/tmp/finance-webkit.sh` to preserve that library path. Browser commands used `FINANCE_WEBKIT_EXECUTABLE=/tmp/finance-webkit.sh` and `LD_LIBRARY_PATH=/tmp/finance-browser-libs/usr/lib/x86_64-linux-gnu`. No system packages were changed. CI installs native dependencies with `playwright install --with-deps chromium webkit`; that normal installation is the preferred reproducible developer setup. The temporary local workaround is outside the production image.
