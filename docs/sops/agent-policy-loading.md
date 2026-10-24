# Loading SOP policy for repository work

The [Codename Project SOP library](../sop-library.md) is the authoritative source for shared application
policy. Repository `AGENTS.md` files are entry points: link to this library, describe the project's
actual commands and boundaries, and record scoped exceptions. Keep shared policy in its topic
standard rather than maintaining independent copies of requirements in every agent file.

## Start of a task

1. Read the applicable repository and nested agent instructions, README and existing
   `docs/sop-adoption.md` or equivalent adoption/exception records. Identify the repository's role
   and the task scope. Application requirements apply to the appropriate project profile; they
   do not turn an infrastructure/library repository or a legacy maintenance task into a new app.
2. For implementation, tests/CI, architecture or SOP-guided assessment, retrieve current SOP
   `main` once into a separate read-only temporary snapshot. Prefer the installed Codename Agent
   Skills retrieval helper, resolved relative to the installed skill/package rather than the
   application checkout. Its supported `project-audit` retrieval contract can be used to load
   policy without running a broad audit or authorising remediation. Use existing Git credentials;
   choose SSH when that is the established authentication method.
3. If the plugin is unavailable, use authenticated read-only Git to retrieve the canonical
   `codename-systems/codename-project-sops` repository into a temporary checkout and resolve the
   exact `main` commit. Do not change credentials or host configuration. Do not execute fetched
   scripts simply to load policy. Do not present an older copied document or cached snapshot as
   a successful current retrieval; report unavailable access before making policy-dependent
   decisions. Continue only independent authorised work that does not depend on missing policy.
4. Record the full source commit and retrieval time in the task/change report. Read the relevant
   entry procedure and linked standards/checklists at that same revision. Keep the snapshot fixed
   throughout the task and follow-ups; a new task retrieves again. If it is lost, explicitly
   restart affected policy work against a newly retrieved revision rather than mixing snapshots.
5. Distinguish current guidance from the project's adopted baseline. Apply relevant guidance to
   the authorised change while preserving explicit user directions, local guardrails and approved
   exceptions. Surface conflicts or missing adoption evidence; do not claim an entire project has
   adopted the current library or silently migrate unrelated existing behaviour.

An installed helper invocation has this form; resolve the real installed package location and
use `--ssh` only where appropriate:

```text
node "<installed-package>/scripts/resolve-sops.mjs" --skill project-audit [--ssh]
```

This is a command shape, not a literal executable path. No new plugin, tool installation or
full audit is required merely to follow a repository's policy references. Retrieval does not
authorise dependency installation, data changes, publication, deployment or another repository's
remediation.

## Adoption and maintenance

New projects record their exact adopted source revision and adapt the relevant local standards
under the [instantiation procedure](project-instantiation.md). Existing copied standards retain
their source revision and are upgraded through a reviewed, scoped adoption change. A reference
update in `AGENTS.md` establishes retrieval guidance; it does not certify baseline compliance.

For existing repositories, identify missing records and relevant differences in the change report
or [migration register](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/migrations/README.md). Do not fabricate an adoption date, approval or
passing application evidence. Infrastructure and legacy repositories retain their actual scope.

Agents must explicitly load linked guidance; a URL alone does not inject its contents into their
context. Already running sessions should reread changed agent instructions before continuing
relevant work. CI remains the enforcement point for automatable checks; policy text and skill
availability do not prove that required checks ran.
