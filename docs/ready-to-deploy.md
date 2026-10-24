# Ready to deploy — Personal Finance

Overall decision: **Not ready**. Initial assessment status: **Unverified**. The accepted implementation plan calls for an initial record; the scoped pre-deployment assessment has not been run. Implementation test results are recorded separately in [verification.md](verification.md).

Owner: Voytek Michalek. Track: private-webapp / monorepo. SOP/checklist revision: `9335fad26de93124a891f6c6544bb388aa366084`. Candidate: local working tree, unreleased. Services: API/webapp image and PostgreSQL, with external private R2/OpenRouter integrations. No production publication/deployment is implied.

The authoritative requirements and applicability are in [checklists/ready-to-deploy.md](checklists/ready-to-deploy.md); follow [sops/ready-to-deploy.md](sops/ready-to-deploy.md). Retain every ID and assess against a recorded candidate/configuration. Use matching test evidence where applicable and run missing/stale targeted checks; do not turn unrelated deployment/backup work into new R gates.

| ID | Requirement | Result | Evidence status |
| --- | --- | --- | --- |
| R01 | Passkey sign-in | Unverified | Initial record; targeted assessment pending |
| R02 | First-admin setup | Unverified | Initial record; targeted assessment pending |
| R03 | Users table | Unverified | Initial record; targeted assessment pending |
| R04 | Add user | Unverified | Initial record; targeted assessment pending |
| R05 | Accept invitation | Unverified | Initial record; targeted assessment pending |
| R06 | Invitation safeguards | Unverified | Initial record; targeted assessment pending |
| R07 | Change role | Unverified | Initial record; targeted assessment pending |
| R08 | Delete user | Unverified | Initial record; targeted assessment pending |
| R09 | Protect the last administrator | Unverified | Initial record; targeted assessment pending |
| R10 | Lost-passkey recovery | Unverified | Initial record; targeted assessment pending |
| R11 | Manage own passkeys | Unverified | Initial record; targeted assessment pending |
| R12 | Logout | Unverified | Initial record; targeted assessment pending |
| R13 | Confirm destructive actions | Unverified | Initial record; targeted assessment pending |
| R14 | Build identity | Unverified | Initial record; targeted assessment pending |
| R15 | Automatic database setup | Unverified | Initial record; targeted assessment pending |
| R16 | No production Compose | Unverified | Initial record; targeted assessment pending |
| R17 | Minimal environment examples | Unverified | Initial record; targeted assessment pending |
| R18 | Environment examples per deployed service | Unverified | Initial record; targeted assessment pending |
| R19 | Quiet, meaningful logs | Unverified | Initial record; targeted assessment pending |

Each item is Unverified because no requirement-specific scoped assessment record exists. The expected behaviour is the matching authoritative checklist row. Next action for every ID: inspect its implementation/test/image evidence from verification.md against that row, record candidate identity, run only missing targeted checks and update this table with the actual outcome. Responsible owner: Voytek Michalek or his appointed verifier. This initial record is an evidence gap, not a claim that the implemented capability fails.
