# Local UX preview

The local preview runs at http://localhost:5174 with the API on port 3000. It uses
an isolated `finance_preview_*` database and normal passkey authentication.
Production remains a separate service and database.

The sample set includes 19 accounts (including six asset/debt accounts), 1,115
transactions across six months, six assets/debts, 20 budgets, eight schedules,
five rules and three prepared PDF reviews. Accounts and records labelled
`Sample ·` cover multiple owners, credit balances, archived accounts, transfers,
refunds, uncategorised items, recurring spending and missing-year review.

Use these flows to explore the changes:

- Overview: recorded/projected balance, past spending, top categories and attention
  shortcuts. Change owner and follow the links into the scoped report or ledger.
- Transactions/Expenses: tick multiple filters, use date presets or custom dates,
  change category/type, remember matching rows, open details and return with Back.
- Accounts: compare compact owner bubbles, change owner filters, open balance and
  forecast tabs, then choose PDF or CSV from Import transactions.
- Categories & rules: search each tab; assign unique category colours and undo them.
- Plan: edit a budget amount in place, follow Spent into Expenses, and switch between
  upcoming occurrences and recurring definitions.
- Assets & Liabilities/Net Worth: inspect group totals, valuations versus transfers,
  date ranges, and exact values through Graph/Table.
- Import review: filter Needs attention, correct a missing year, inspect reconciled
  entries and use the persistent review action bar.
- Settings: open People, AI, Release notes and System details from the directory.

Sample upload files are generated under ignored `artifacts/preview-samples/`:
`sample-transactions.csv`, `sample-review.pdf`, `sample-missing-year.pdf` and
`sample-reconciliation.pdf`.

To add missing fixtures again, after creating/migrating the preview database and
registering its first administrator, run:

```sh
pnpm exec tsx scripts/seed-preview.mjs finance_preview_0358ccf3b4
```

The script refuses ordinary/production database names and non-local hosts. Its
stable IDs and insert-only writes preserve user edits and existing records.
The sample invited member is for ownership display; the seeder grants no session,
passkey or invitation. It does not start a server or create the database itself.
