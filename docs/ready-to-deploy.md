# Ready to deploy — Personal Finance

Overall decision: **Ready to deploy** for the application checks R01–R19.
Assessment date: 25 October 2026. Owner: Voytek Michalek; verifier: Codex under
his instruction to check, release 0.0.1 and deploy the personal application.
Track: private-webapp. All nineteen checks apply.

## Candidate and evidence identity

The adopted checklist remains `9335fad26de93124a891f6c6544bb388aa366084`;
requirements are defined only in [checklists/ready-to-deploy.md](checklists/ready-to-deploy.md).
The task policy snapshot was retrieved at `2026-10-25T01:18:39Z`, revision
`b26c3b14c98aa17a2b929d1f211e8d11cbb0440b`. Personal repository CI, ownership,
owner-authorised release deployment and private database credential exceptions
remain recorded in [sop-adoption.md](sop-adoption.md).

Candidate source: `535c684c31fd0bade5c42c58a9597ecd97853249` plus the auth error-envelope
fix and corrected real-device test in this report's commit. Relevant Git blob IDs:

- `apps/api/src/modules/access/auth.ts`: `d2b9c6f561be101be6efae76b03be5b9eceef0e6`.
- `e2e/access.spec.ts`: `33aa9cc2b61839af6e34cea6242108c9f69b2a09`.
- `scripts/smoke-image.mjs`: `f1469341a4fc10b29d927422ba240a4c954af800`.

Evidence collected on 25 October 2026:

- **A — API integration:** 14/14 access cases passed against isolated local
  `finance_test` after the auth response fix. The earlier focused set also passed
  all 19 access/diagnostics/receipt cases. Commands use `testEnvironment()` and
  Vitest's integration config; no household or production database was reset.
- **B — real browser:** the complete `e2e/access.spec.ts` Chromium journey passed
  with retries disabled. A temporary local harness served the existing production
  build on localhost:3107 because another project owns port 3000. It changed only
  the test origin/listening port, used `finance_e2e`, and exercised real WebAuthn
  with separate primary, backup and invited-person virtual authenticators.
- **C — desktop/mobile:** [Validate run 40171229037](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40171229037)
  on `535c684` passed all four `e2e/readiness.spec.ts` cases, including System
  metadata and user details/actions. Its browser stage had 52 passes, 3 deliberate
  skips and one failure in the newly expanded passkey test. That failed case is
  superseded by B; this run is not represented as a full CI pass.
- **D — production image:** local `personal-finance:verification`, version 0.0.1,
  release tag `readiness-check`, build commit marker `pre-release-working-tree`,
  built from the corrected candidate. `pnpm ci:smoke` passed in disposable Docker
  containers with PostgreSQL 16.10, synthetic credentials and fixtures. It checks
  migrations, frontend/non-root runtime, metadata headers, durable bootstrap,
  persisted data and default/enabled/disabled diagnostic logging. No production
  bootstrap token was consumed.
- **E — inspection:** repository configuration, Dockerfile/entrypoint, environment
  consumers and all application-owned logging sinks reviewed. Guardrails, API
  typecheck, affected ESLint and `git diff --check` passed.

The previous full [Validate run 40169530139](https://github.com/VoytekMichalek/personal-finance-app/actions/runs/40169530139)
passed on `c55f108`; it is supporting history, not proof for subsequent changes.
Full Validate CI must pass on the final release commit before tagging, separately
from this scoped assessment. Release then repeats validation, image smoke and scan.

## Results

| ID | Result | Evidence and observed behaviour |
| --- | --- | --- |
| R01 | Passed | B: invited person signs in through real WebAuthn; `/api/access/me` confirms their identity and the dashboard loads. |
| R02 | Passed | A: cancelled pending enrolment remains retryable, concurrent issuance leaves one live grant. B: simultaneous completion creates exactly one active admin and one key. D: completed setup stays closed after container replacement, token removal and user deletion/restart; existing account balance survives. |
| R03 | Passed | C: representative Users entries expose name, email, role and state on desktop/mobile. |
| R04 | Passed | B: administrator creates an invitation; actual clipboard content equals the generated link. |
| R05 | Passed | B: recipient opens the invitation, registers a passkey and reaches the dashboard. |
| R06 | Passed | A: expired, consumed and replaced invitations and their in-progress grants are rejected. |
| R07 | Passed | A: demotion revokes the old session; a fresh member session receives 403 for Users and 200 for household data. |
| R08 | Passed | A: deleted person loses access while transaction and audit history remain. |
| R09 | Passed | A: final admin deletion and demotion are rejected; concurrent deletion preserves an administrator. |
| R10 | Passed | A: reset revokes keys/sessions and issues a replacement invitation without changing identity. C: the deliberate reset action displays the new link. |
| R11 | Passed | B: a different device adds a second key, removal succeeds, final-key removal is rejected with a visible explanation. A verifies server ownership and the client-compatible error message. |
| R12 | Passed | B: logout makes protected API access return 401 and a protected page show sign-in. A verifies server-side invalidation. |
| R13 | Passed | C: dismissing delete/reset preserves state; accepting performs the selected action. B: passkey removal requires its confirmation dialog. |
| R14 | Passed | C: all four System fields match generated build metadata on desktop/mobile. D compares readiness headers with image metadata. |
| R15 | Passed | D: all five committed migrations apply automatically; a deliberately conflicting isolated schema makes startup exit unsuccessfully before serving. E: entrypoint retains migrate-deploy before server startup. |
| R16 | Passed | E: one API/webapp image and an independent PostgreSQL Dokploy service; Compose is local-only. Hosting instructions preserve that topology. |
| R17 | Passed | E: every example key has an actual owner/consumer, documented below; stable policies remain in source. D rejects insecure production origins; E confirms placeholder rejection in configuration validation. |
| R18 | Passed | E: root `.env.example` is explicitly runtime-only for the one combined API/webapp service. `.env.local.example` separately documents root local inputs; dotenv reads that root path. Build identity uses build arguments/artifact, not runtime credentials. |
| R19 | Passed | A/D/E: expected 401/403/400/404 requests and repeated polls stay quiet; a controlled missing-table fault produces a safe `request_failed` error. SIGUSR2 enables safe request diagnostics and disables them again. Marker tests exclude secret query/body/header/cookie/path values and credentials from captured logs. |

## Environment and logging inspection

`DATABASE_URL` belongs to Prisma runtime/migrations. `BETTER_AUTH_URL` defines the
canonical auth origin, RP hostname and mutation origin checks. `BETTER_AUTH_SECRET`
protects auth and stored integration secrets. `FIRST_USER_TOKEN` gates initial
bootstrap only. Optional `OPENROUTER_API_KEY` supplies the provider fallback;
Settings → AI can store the key instead. The four R2 keys are consumed together by
the server-side S3 client for private receipts. Consumers are in `lib/config.ts`,
`lib/db.ts`, `modules/access/`, `modules/integrations/` and `integrations/`.
No browser bundle receives these secrets; `.dockerignore` excludes local env files.

Logging inspection covers error middleware, the auth wrapper/library logger,
statement-worker failures and receipt compensation failures. Expected denials
remain separate from unexpected errors. No dedicated actionable warning condition
or incident-detection subsystem is implemented; none was invented for assessment.
Better Auth's library logger is disabled; unexpected wrapper failures have a safe
error event. Diagnostics log generated request ID, method, registered route pattern,
status and duration, never raw URL/body/header content. Normal startup is one info
event; normal health/readiness traffic is omitted in both modes. The separate
operator-only recovery CLI intentionally emits a one-time recovery link to its
invoking operator; it is not a running service log sink.

No applicable R check remains Blocked or Unverified. This decision covers the
recorded source/configuration only. It does not assert that a release is published
or production is live. Registry publication, deployment, the live R2 check and
post-migration backup/restore results belong in [hosting.md](hosting.md).
