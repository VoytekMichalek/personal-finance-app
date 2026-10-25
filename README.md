# Personal Finance

A private, shared household finance app for Voytek and his wife. AUD only; calendar dates and monthly reporting follow Brisbane time. Both members can manage every financial record. Ownership labels filter reports; administrators manage access.

React/Vite/TypeScript, Tailwind and shadcn-style Radix components, Lucide, React Hook Form/Zod and TanStack Query; Express, PostgreSQL, Prisma and Better Auth passkeys. The production image serves the API and compiled web app together.

## Start locally

Install [mise](https://mise.jdx.dev/), Docker, Poppler (`poppler-utils`) and Tesseract with English language data (`tesseract-ocr`). PDF extraction uses Poppler; image-only pages use Tesseract. Production images include both. From this directory:

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
cp .env.local.example .env
# Generate separate random BETTER_AUTH_SECRET and FIRST_USER_TOKEN values.
# Example: openssl rand -hex 32 (run separately for each).
mise exec -- pnpm services:up
mise exec -- pnpm ci:prepare
mise exec -- pnpm db:migrate:deploy
mise exec -- pnpm dev
```

Open http://localhost:5173. Choose **Create first admin**, enter your name, email and the `FIRST_USER_TOKEN` from `.env`, then create a passkey. The bootstrap stays closed after successful enrolment. Invite your spouse from **Settings → Users** and share the one-use, seven-day link directly. No email service is required. Add a second passkey on another device before removing an old one.

A local ignored `.env` and migrated PostgreSQL service have already been prepared in this checkout. Existing local secrets must be kept; do not overwrite `.env` when following the instructions here. No financial demo records are seeded.

## What you can do

- Overview with linked balances, monthly income/spending, budgets, forecast and upcoming bills.
- Bank, cash and credit accounts; dated opening balances; expenses, income, refunds and linked transfers; search, filters, editing and bulk categories.
- Household/person labels, editable categories and ordered merchant rules, and archival with retained history.
- Private PDF statement imports from account setup or account detail, all-page extraction/OCR, optional reviewed AI reading, opening-balance import, category and recurring suggestions, atomic confirmation and original downloads.
- Dedicated account detail, separate Net Worth and Assets & Liabilities pages, manageable category/subcategory hierarchy and styled keyboard-accessible dropdowns.
- CSV mapping and preview, signed or debit/credit amounts, explicit date formats, reviewed refunds/transfers, duplicate warnings, saved mapping and atomic, idempotent confirmation.
- Optional OpenRouter mapping/category suggestions with redacted samples, schema validation, restrictive provider policies and an explicit approved model selection.
- Repeating calendar-month budgets, scheduled income/bills and subscriptions, matched occurrences and 30/90/180/365-day forecasts without budget/schedule double counting.
- Net-worth history using account ledgers and dated property, investment, superannuation and other valuations.
- Private JPEG/PNG/WebP/PDF receipt uploads up to 20 MB using Cloudflare R2, authenticated viewing/download/deletion and recoverable failures.

Configure the OpenRouter key and model in **Settings → AI**; changes take effect immediately. R2 remains configured in the ignored `.env` using [.env.local.example](.env.local.example), followed by an API restart. The optional `OPENROUTER_API_KEY` environment variable is a fallback when no key is saved in Settings. Run `pnpm integrations:verify` for provider verification. It sends synthetic AI data and uploads/downloads/deletes a synthetic R2 object. Live verification awaits your credentials; fixture checks do not certify those external accounts.

## Commands and ownership

| Command | Purpose |
| --- | --- |
| `pnpm dev` | API on 3000 and Vite on 5173, with `/api` proxy |
| `pnpm services:up/down/status` | Local PostgreSQL service only; down preserves its volume |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate:dev` | Create a reviewed development migration |
| `pnpm db:migrate:deploy` | Apply committed migrations |
| `pnpm ci:prepare` | Build shared schema declarations and generate Prisma before checks on a clean checkout |
| `pnpm guardrails / lint / typecheck / test` | Source limits and static/unit checks |
| `pnpm test:integration` | Real PostgreSQL API, permissions and concurrency tests |
| `pnpm build` | Build shared schemas, API and frontend once |
| `pnpm test:e2e` | Chromium desktop and WebKit mobile against that build |
| `pnpm ci:validate` | Guardrails, lint, types, tests, audit, build and E2E |
| `IMAGE=personal-finance:verification pnpm ci:smoke` | Isolated production-image migration/readiness/configuration checks |
| `pnpm integrations:verify` | Synthetic live OpenRouter/R2 check after configuration |

Financial logic and schemas live in `packages/shared`; API domains in `apps/api/src/modules`; screens and feature components in `apps/web/src`. Money uses integer cents (PostgreSQL bigint, checked safe integers at API boundaries); posted ledger dates are calendar dates and audit timestamps are UTC. Transactions use optimistic versions and imports/schedule matching use database atomicity and unique constraints.

Read the [user guide](docs/user-guide/index.md), [testing guide](docs/testing.md), [deployment and backup guide](docs/hosting.md), [SOP adoption and exceptions](docs/sop-adoption.md) and [initial verification record](docs/verification.md) and [statement/account verification](docs/verification-statements.md). The scoped R01–R19 assessment is recorded in [ready-to-deploy](docs/ready-to-deploy.md); implementation verification is separate from that assessment.

## GitHub Actions ownership

This personal repository owns its CI and release workflows. [Validate](.github/workflows/ci.yml) runs the local validation scripts, image smoke tests and vulnerability scan on pushes and pull requests. [Release](.github/workflows/release.yml) reuses that same local workflow, then verifies, builds, smoke-tests and scans the tagged image before publishing to `ghcr.io/voytekmichalek/personal-finance-app` and creating GitHub release notes.

Neither workflow calls a Codename CI wrapper, reusable workflow or action. Release uses GitHub's repository-scoped `GITHUB_TOKEN`; no Codename organisation credentials are required. Keep this ownership permanent even if shared Codename workflows become accessible. The `ci:*` package scripts run code in this repository. After publishing the immutable version and GitHub Release, release updates `latest`, calls the personal app's `DOKPLOY_DEPLOY_WEBHOOKS` secret and waits for the expected release tag/commit at `https://finance.michalek.app/ready`. Ordinary main pushes validate without deploying. Releases share a concurrency group to prevent overlapping production promotions.

Owner: Voytek Michalek. Personal repository, GHCR and CI/release ownership are permanent project decisions; see the [adoption record](docs/sop-adoption.md). See GitHub Actions and the deployment record for actual release and rollout outcomes.
