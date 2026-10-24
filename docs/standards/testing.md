# Testing standard

Use Vitest for units, schemas, utilities, services, API handlers, database-backed integration and useful React component tests. Use Playwright for critical browser workflows: authentication, record creation/editing/deletion, validation, permissions, uploads and primary application flows. Both belong in serious applications from the initial baseline.

Backend behaviour changes require backend tests; frontend behaviour changes require frontend tests; cross-cutting changes need coverage in each affected area. Protect authentication/session and permission-critical paths with regression tests. Test observable behaviour rather than implementation details.

## Coverage by project type

Choose coverage using the [project track](project-tracks.md); retain desktop/mobile coverage for every browser surface that exists.

| Profile | Required coverage |
| --- | --- |
| Private webapp | API/database integration; bootstrap and invitations; member/admin permissions; Users/System; user coin, self-service passkeys and logout; Documentation; core workflows |
| Site-only | Content/schema/metadata helpers in Vitest; public navigation, key pages, content, forms where present, metadata/canonicals, sitemap/robots, missing/unpublished 404 responses and internal links against the built site |
| Combined | Both rows above plus API/admin route and asset handling, public data filtering, denied private access, publishing/unpublishing and authorised revalidation, including relevant pages and sitemap updates |

Public-site `check:seo` and `check:links` commands must run real checks. They may select dedicated Playwright files also included in the full suite, so CI need not run them twice. Verify meaningful initial HTML using direct HTTP responses or a JavaScript-disabled browser context; a hydrated page assertion alone does not prove server rendering. Check actual HTTP status codes for missing content. Vitest helper tests do not replace acceptance of a running Next.js production build.

Smoke-test every built production image. Site checks cover readiness, `/`, robots, sitemap, a representative published page and a missing page, with correct status and content. API/admin checks cover readiness after migrations, unauthenticated protected API rejection, admin assets/deep links and immutable System metadata. Exercise fresh, pending/current and failed migration states under the [deployment standard](environment-and-deployment.md#prisma-migrations-are-automatic-on-deployment). Combined E2E uses both services; isolated image smoke tests can use controlled upstream fixtures but cannot replace cross-service coverage. Use disposable test data and no production credentials.

Include the authoritative [per-service configuration checks](environment-and-deployment.md#pre-deployment-configuration-verification) and [application logging checks](application-logging.md#pre-deployment-verification) in isolated production-image verification for every profile. Capture application log output as well as HTTP behaviour and retain genuine-failure controls; verify input ownership/phases against actual consumers. These checks run before deployment without a live production environment. Reuse valid candidate/image evidence rather than duplicating identical runs.

The scoped [pre-deployment assessment](../sops/ready-to-deploy.md) uses only the authoritative [R01–R19 checklist](../checklists/ready-to-deploy.md). Map existing passing CI evidence to the listed capabilities and candidate; run targeted verification only where evidence is missing, stale or affected. An assessment alone does not require a new full CI/E2E run, release/public-image evidence, SEO/general product acceptance or ten-run timing streak. Normal development and release validation policies above remain applicable to their own work; do not import them as additional assessment gates. CI success cannot prove an uncovered R capability.

## Coverage ownership and efficient execution

Choose tests by the failures they detect and the boundaries they exercise, rather than a fixed
unit/integration/browser ratio or a target test count. Record each critical risk, its primary
test layer and any complementary coverage in the project's testing documentation.

- Use unit/component tests for deterministic logic, validation and local rendering behaviour.
  Use real API/database integration tests for transport, permissions, persistence, constraints,
  transactions and concurrency. Mocked services do not establish those real boundaries.
- Use browser tests for critical user journeys and browser-specific behaviour, including forms,
  navigation, authentication, responsive layout, keyboard/focus, uploads and downloads. Move
  request-only or pure calculation cases to a suitable lower runner only when their real
  transport/data coverage and independent reference assertions are retained.
- Complementary tests at different layers are justified when they detect different failures.
  Run identical selections once per required validation gate: a coverage-enabled unit run
  normally owns those unit assertions, rather than repeating them without coverage first.
  Keep separately selected integration, contract or provider checks that it does not include.
- Before replacing or retiring a test, map its assertions and protected risks to the proposed
  coverage. Compare the old and proposed suites using the same candidate and isolated fixtures;
  demonstrate detection of relevant known regressions or controlled failure cases. If equivalent
  protection cannot be established, retain the test and record the unresolved evidence.
- Preserve coverage thresholds, required desktop/mobile surfaces, real integration boundaries,
  security checks and production-image verification. Fewer tests or a green run alone does not
  prove equivalent reliability. Do not hide failures through skips, weakened assertions,
  increased timeouts or retries.

Use the [efficiency review checklist](../checklists/testing-efficiency-review.md) for changes to
test ownership, repeated execution, setup or concurrency. It guides the scoped change and does
not add gates to the separate R01–R19 pre-deployment assessment.

## Parallel execution and dependencies

Run independent tests concurrently by default. Declare required setup as fixtures or explicit
dependencies, then allow the remaining independent tests to run concurrently. Prefer self-contained
tests; a multi-step user journey may remain one ordered test. Do not rely on file names, incidental
worker assignment or another test's side effects to establish a prerequisite.

Use isolated accounts, records and deterministic cleanup. Identify shared database settings,
schemas, seeds, authentication budgets, files and provider/mail fixtures before increasing
concurrency. Browser-context isolation alone does not isolate these backend resources. Where
isolation is feasible, implement it; otherwise sequence only the conflicting group or use an
exclusive execution stage. Putting tests on one worker does not stop another worker changing
the same global state.

Derive the worker budget from the runner's CPU/memory and application/database capacity. A
runner-derived default or percentage is a starting point, not an automatic reliability tuner.
Use the resources available to the test process: check container quotas and CPU affinity rather
than assuming the host CPU count is available. Budget concurrently running test workspaces,
application servers and database services together; each runner's default can otherwise
oversubscribe the same machine. Record these allocations alongside the worker count.
The runner cannot infer undeclared dependencies or find the fastest reliable concurrency.
Benchmark suitable configurations, including higher counts where capacity permits, and record
elapsed time, setup cost, total runner time/resource pressure, failures and retries. Do not
mandate one fixed count across projects or maximise workers without evidence of useful throughput.

Document explicit limits, sequential groups and their reasons. Review them when fixtures or runner
capacity changes; do not retain a whole-suite single-worker restriction without a current reason.
Increasing Playwright workers permits file-level concurrency; cases inside a file require a
separate parallelism/isolation review. Do not assume increasing workers parallelises every case.

Validate concurrency changes at the proposed configuration with retries disabled, preserving
selected tests, projects and integration behaviour. Exercise shared-state cleanup and failure
paths, record repeat-run evidence and then run the full required validation once. Apply the
existing ten-consecutive-run requirement below to affected timing-sensitive tests; it does not
require ten repeats of every unchanged full suite. Treat an unproven change as a proposal rather
than claiming unchanged reliability or a measured saving.

## Scope of deterministic waiting

The following rules apply by default to **new and modified Playwright E2E tests**, including templates and examples. Preserve realistic behaviour, isolation and coverage. Existing-suite conversion is separate tracked work in the [migration register](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/migrations/README.md), not an automatic repository-wide rewrite.

## Browser-controlled time

Use Playwright's clock for browser-owned timeout, debounce, autosave and retry tests. Install it before navigation or any application timer is created. Installing it after a fixture has already navigated is too late; adapt that fixture or install at context setup before it visits the app.

`clock.install()` starts a controllable clock but does not by itself keep time frozen. For exact boundaries, let required initial loading complete, then pause before triggering the behaviour under test. Ensure any advance used to pause happens before the target timer exists. Account for animations and readiness timers deliberately so a frozen clock does not stall setup.

| Need | Method |
| --- | --- |
| Jump past a deadline; firing each due timer at most once matches the scenario | `clock.fastForward()` |
| Observe repeated interval callbacks, polling, countdown ticks or chained retries | `clock.runFor()` |
| Freeze the displayed date while keeping timers real | `clock.setFixedTime()`; this does not accelerate timers |

Use numeric milliseconds when it improves clarity. Assert the pending state before the deadline, cross the deadline, assert the outcome, and exercise recovery. Do not merely advance 30 seconds and check an error that might have appeared immediately. The methods and installation ordering are described in [Playwright's clock guide](https://playwright.dev/docs/clock) and [API reference](https://playwright.dev/docs/api/class-clock).

## Observable readiness

Replace arbitrary `waitForTimeout()` calls and sleep helpers with retrying locator assertions, specific requests/responses, URL/navigation completion, downloads or explicit application events. Wait for the condition that makes the next action valid. A page load event or generic network quietness may not mean the feature is ready; avoid `networkidle` as a universal readiness shortcut.

Register an event wait **before** the action that can emit it:

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export' }).click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toBe('report.csv');
```

Use precise response predicates including route/method where needed. Do not increase global timeouts or remove assertions to conceal a readiness race.

## Test-controlled loading states

Hold the relevant mocked response behind a promise owned by the test. Assert loading while the response is held, release it, then assert completion. Register the route before triggering the request and release barriers in cleanup so failures cannot strand handlers.

```ts
let release!: () => void;
const responseGate = new Promise<void>(resolve => { release = resolve; });
await page.route('**/api/report', async route => {
  await responseGate;
  await route.fulfill({ json: { message: 'Report ready' } });
});
try {
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page.getByRole('status')).toHaveText('Generating…');
  release();
  await expect(page.getByRole('status')).toHaveText('Report ready');
} finally {
  release();
  await page.unrouteAll({ behavior: 'wait' });
}
```

This barrier replaces an arbitrarily delayed route response. Keep all state inside the test or a test-scoped fixture. Mocked UI timing coverage complements real API/database integration coverage; it must not replace it.

## Short example: a 30-second timeout and recovery

The app in this example starts a 30-second browser timeout when **Generate report** is clicked. The test has already routed the first API response behind a barrier and configured a subsequent successful response. No real network timeout is being accelerated.

```ts
await page.clock.install();          // Before navigation/application timers.
await page.goto('/');
await expect(page.getByRole('button', { name: 'Generate report' })).toBeEnabled();
// Pause before the click; advancing to this point cannot consume the target timer.
await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));

await page.getByRole('button', { name: 'Generate report' }).click();
await expect(page.getByRole('status')).toHaveText('Generating…');
await page.clock.fastForward(29_999);
await expect(page.getByRole('status')).toHaveText('Generating…');
await expect(page.getByRole('alert')).toBeHidden();
await page.clock.fastForward(1);
await expect(page.getByRole('alert')).toHaveText('Request timed out. Try again.');
await page.getByRole('button', { name: 'Try again' }).click();
await expect(page.getByRole('status')).toHaveText('Report ready');
await expect(page.getByRole('alert')).toBeHidden();
```

The [complete runnable example](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/examples/playwright/timeout.spec.ts) includes the controlled routes and cleanup. It also tests the loading barrier and repeated callbacks. Adapt the pattern to the real application and preserve its request cancellation/stale-response behaviour and recovery assertions.

## Negative assertions

An immediate “not visible” or “request count is zero” can pass before the bug has time to occur. First advance through the relevant browser timer window, await the operation's completion, or establish another meaningful observable boundary. Then assert the absence.

For example, after cancelling a 500 ms autosave, advance beyond 500 ms before asserting no save occurred. For a backend operation, wait for its real completion or controlled server-side evidence before checking absence; moving browser time does not prove the backend finished. Specify which interval or completion boundary the assertion covers.

## Real time and integration boundaries

Browser clocks do not advance backend/database expiry, server jobs, external services, transport timeouts or reliably accelerate real media recording. Use injected server clocks or deliberately expired records for backend expiry tests when appropriate, keeping integration coverage of actual persistence and checks.

Retain real timing when it is part of what must be verified, such as a minimum real recording duration. Document each justified real wait beside the test: the external timing source, why virtual time or a completion event is insufficient, and the smallest required duration. Use observable readiness before and completion after the wait. This is a reasoned exception, not permission to use sleeps for convenience.

## Efficient setup and isolation

- Install browsers once per job, outside test/server startup. Derive the engine list from enabled Playwright projects; mobile emulation may use Chromium, while an iPhone/WebKit project requires WebKit. Install all required engines and only those engines.
- On fresh Linux CI runners, use `pnpm exec playwright install --with-deps <required-engines>` so native dependencies are present. A persistent cache does not prove the correct browser revision or native dependencies are installed. Document any validated preinstalled image instead of duplicating installation.
- Build once per job where the same build is used. Playwright's `webServer` command serves existing output and must not build/install again. Release packaging in a separate environment may need its own build; do not remove necessary validation.
- Retain desktop/mobile projects, assertions, real integration coverage and justified concurrency constraints. Apply the coverage-ownership review above before replacing tests; do not skip projects, loosen expectations or use retries to disguise failures.
- Use test-scoped browser contexts, unique accounts/records and deterministic cleanup. Never introduce shared mutable fixtures, a shared logged-in account modified by multiple workers, or globally shared response barriers for speed.
- Keep the worker configuration constant when measuring a waiting/setup refactor. Review worker tuning as a separately identified concurrency change under the parallel-execution rules above. Stateful database/auth lifecycle tests may need isolated databases or a narrowly sequenced stage; preserve their real concurrency assertions and isolation.

## Validation for timing changes

Run each affected timing-sensitive test **ten consecutive times without retries** using the same enabled projects and relevant worker configuration. A sequential invocation loop avoids parallel `--repeat-each` runs being mistaken for ten consecutive suite passes:

```bash
for run in $(seq 1 10); do
  pnpm exec playwright test e2e/affected-timing.spec.ts --retries=0 || exit 1
done
pnpm ci:validate
```

Select all affected files/cases, not just one passing example. Record command, selected tests/projects, worker settings and results. Any failure invalidates the ten-pass streak: fix it, then restart the sequence. The follow-up command must include the full affected suite and all repository-required checks. If `ci:validate` already does this, do not run the identical full suite/build a second time. Keep other required checks that it does not include.

For a documentation-only SOP update, validate the documentation and any runnable examples changed here. Do not claim the ten-pass requirement has been satisfied for applications that have not yet adopted or changed tests.

Use the [reviewer checklist](../checklists/playwright-timing-review.md) for every timing change.
