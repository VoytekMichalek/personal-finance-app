# Contributing

Read AGENTS.md and docs/sop-adoption.md. Preserve the Node/pnpm pins and the 48-hour dependency age gate. Changes to money, date handling, access, imports or storage need regression coverage at the correct layer. Keep schemas shared and server permissions authoritative.

Use focused Conventional Commits with scopes. Run `pnpm ci:validate` before committing. Schema changes need committed SQL migrations; inspect generated SQL before applying it. Never reset the real finance database or commit `.env`, invitations, bootstrap tokens, receipts or bank CSVs. Keep user guides current.

Use `codex/` for task branches when needed. Publication, tags, pushes and deployment require the user's applicable authorisation. CI validates branch/PR changes; release workflow accepts immutable annotated semver tags reachable from main/master and publishes only after all gates pass. Personal namespace and local workflow exceptions are documented in the adoption record.
