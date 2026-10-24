# Codename Project SOPs

Versioned operating procedures for agents and engineers building Codename Systems software. For new-project setup, start with the [Project Instantiation SOP](sops/project-instantiation.md). For a first-deployment assessment, start with [Ready to deploy](sops/ready-to-deploy.md). Read the standards relevant to the selected procedure and project track.

**Default first build: a full build-out on a standard path** — private webapp, public site-only, or combined. Implement the requested features and all applicable path requirements through validation and handover. Reduced scope or a different path requires a specific user request; see the [first-build rule](sops/project-instantiation.md#default-first-build-full-implementation).

| Document | Use it for |
| --- | --- |
| [Agent policy loading](sops/agent-policy-loading.md) | Current policy retrieval, scoped application and adopted revisions |
| [Project instantiation](sops/project-instantiation.md) | Stack, structure, tooling, setup procedure, commands and handover |
| [Ready to deploy](sops/ready-to-deploy.md) | Scoped application/configuration assessment, candidate evidence and actionable results |
| [Project tracks and public websites](standards/project-tracks.md) | Private webapp, public site-only and combined stacks, topology and SEO |
| [Authentication and user management](standards/authentication.md) | Better Auth, passkeys, bootstrap, invitations and roles |
| [Application UI](standards/application-ui.md) | Settings → Users/System, passkey/logout user coin and Codename attribution |
| [Environment and deployment](standards/environment-and-deployment.md) | Per-service environment examples/phases, minimal configuration, local Compose, migrations and manual Dokploy deployment |
| [Application logging](standards/application-logging.md) | Quiet expected requests/polls, meaningful severity, optional diagnostics/redaction and isolated verification |
| [Testing](standards/testing.md) | Vitest, Playwright, deterministic waiting and validation |
| [User documentation](standards/user-documentation.md) | The Documentation sidebar item and maintained user guides |
| [Project templates](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/README.md) | Files and examples to adapt into a new project |
| [Instantiation checklist](checklists/project-instantiation.md) | Acceptance and handover evidence |
| [Ready-to-deploy checklist](checklists/ready-to-deploy.md) | Single authoritative R01–R19 assessment list, applicability and decision rule |
| [Timing review checklist](checklists/playwright-timing-review.md) | Review of new or modified timing-sensitive E2E tests |
| [Testing efficiency checklist](checklists/testing-efficiency-review.md) | Coverage ownership, setup reuse and measured concurrency |
| [Existing-project migration register](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/migrations/README.md) | Separately scoped adoption work |
| [Approved OpenRouter models](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/catalogs/README.md) | Shared JSON model list for interfaces that adopt it, with its consumer contract |

## Document control

| Field | Value |
| --- | --- |
| Owner | Codename Systems |
| Audience | Coding agents, engineers, consultants, technical leads and project owners |
| Baseline | 1.0.1; see [change history](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/CHANGELOG.md) |
| Last updated | 2026-10-01 |
| Review cycle | Every six months, or after a major stack or process change |
| Repository | [codename-systems/codename-project-sops](https://github.com/codename-systems/codename-project-sops) |

## How agents consume this library

Before implementation or SOP-guided assessment, follow [agent policy loading](sops/agent-policy-loading.md): retrieve current policy once, record the exact source revision, read the relevant standards and distinguish them from the adopted project baseline. Root and nested `AGENTS.md` files must direct agents to this library while retaining local commands, scope and exceptions. Existing repository reference/adoption updates are separately authorised migration work.

1. Select the procedure for the task: project instantiation or ready-to-deploy assessment. Read its entry SOP, select the project track/mode, then read the relevant linked standards, checklist and template. **Must** and **must not** are requirements; **should** is a default with a documented reason required to vary it.
2. Record the exact SOP release or commit, adoption date and exceptions in the consuming project's `docs/sop-adoption.md`. Until a release exists, use a real commit SHA; never claim an unpublished tag exists.
3. Adapt templates to the actual project. Replace tokens, verify commands and workflow interfaces, and remove unused optional features. Do not copy example domains as real requirements.
4. Include the applicable procedures, standards and checklists in the project's `docs/sops/`, `docs/standards/` and `docs/checklists/` so agents can work without access to another application repository. Adapt links to the generated layout and keep a record of their source revision. Upgrades are explicit changes with review and validation.
5. Apply timing guidance to new and modified Playwright tests. Record broader existing-suite conversion in the migration register; do not silently rewrite other repositories.

A pre-deployment assessment writes `docs/ready-to-deploy.md` using the [report template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/docs/ready-to-deploy.md.tmpl). Its **Ready to deploy** / **Not ready** decision depends only on the applicable [R01–R19 checks](checklists/ready-to-deploy.md). This approved scope reduction verifies listed application capabilities/configuration, without certifying full instantiation, product/SEO acceptance, release publication, production provisioning, backups or live deployment. Those policies remain in their own standards. Plugin skills reference this checklist rather than maintaining a copy; consumer implementation and installed snapshots remain separate.

This library defines application requirements; it is not permission to deploy, publish a release, delete data, or change another repository. Explicit project instructions take precedence. Record material deviations rather than leaving contradictory guidance.

## Maintaining this repository

Read [CONTRIBUTING.md](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/CONTRIBUTING.md). This repository contains documentation, templates and small executable examples; it does not need an application stack, database or production image of its own.

Run documentation checks with:

```bash
python3 scripts/check_docs.py
python3 -m unittest discover -s scripts -p 'test_*.py'
```

The executable clock example has its own [verification instructions](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/examples/playwright/README.md). No product application or existing E2E suite is migrated by this baseline.

See the [baseline validation record](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/docs/validation.md) and [retention map](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/docs/baseline-retention.md) for verification evidence and the disposition of the original SOP requirements.
