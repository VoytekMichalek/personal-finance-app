# SOP: Ready to deploy

Use this procedure for the scoped pre-deployment application assessment. There is one result: **Ready to deploy** or **Not ready**, determined **only by the applicable R01–R19 checks** in the [authoritative checklist](../checklists/ready-to-deploy.md). This explicitly approved reduction replaces the broader assessment contract; consuming skills must reference the checklist rather than keep their own list.

The result verifies the listed application capabilities and configuration before production deployment. It does not certify full instantiation, general product acceptance, public-site/SEO quality, release publication, registry image availability, production target provisioning, backup/restore arrangements or live post-deployment success. Those policies remain in the [instantiation SOP](project-instantiation.md), [testing standard](../standards/testing.md), [project tracks](../standards/project-tracks.md) and [CI/release/operational deployment standard](../standards/environment-and-deployment.md). They are not additional decision gates here.

## Inputs and scope

Read the project's README/AGENTS, adoption record where available and code/configuration relevant to the listed checks. Establish the selected profile, enabled services, authentication/database capabilities, candidate source revision and any relevant working-tree changes. Record the adopted checklist revision and the local build/fixture/configuration identity used as evidence. Missing background documentation affects a result only where it prevents verification of a specific applicable R check; do not create a baseline-alignment gate.

Apply the checklist's applicability rules. Site-only projects retain all IDs and explain unused authentication/System/database capabilities. Combined projects include every relevant service under the existing IDs. Record implementation exceptions as context without treating them as proof that an applicable check passed.

Use repository inspection, isolated environments and safe fixtures for all verification. A locally built production application/image is sufficient where build/startup/runtime behaviour must be exercised. Release records, published digests, registry access, production credentials and a provisioned/live production target are not required inputs. Production first-admin bootstrap remains an operator action after deployment; never consume its token during assessment.

## Assessment procedure

1. **Identify the candidate and applicability.** Record the source/configuration/build identity, inspect relevant repository state and determine applicability for every checklist ID. Preserve unrelated work. Never claim local edits were included in an earlier build or CI run.
2. **Map existing evidence to checks.** Inspect implementation and link actual passing CI/verification records to the R checks they cover. CI success alone does not prove an uncovered capability; a test command listed in package metadata is not a passing run. Reuse evidence for the same candidate and requirement.
3. **Verify only missing, stale or affected evidence.** Run targeted checks for the listed capabilities in isolated environments, with disposable accounts/databases and safe fixtures. Follow the referenced implementation policy for each capability, not the entire standard's unrelated acceptance requirements. Preserve meaningful coverage and isolation under the [testing standard](../standards/testing.md); changes to application tests still follow its normal rules. An assessment alone requires no new full-CI run or ten-run timing streak.
4. **Classify each check.** Use Passed, Blocked, Unverified or Not applicable as defined below. Keep all R01–R19 IDs in matching order. Do not mark an applicable failure or missing evidence Not applicable.
5. **Write the report and explain the result.** Complete [the report template](https://github.com/codename-systems/codename-project-sops/blob/9335fad26de93124a891f6c6544bb388aa366084/templates/project/docs/ready-to-deploy.md.tmpl) at `docs/ready-to-deploy.md`, with actionable details for every Blocked/Unverified item. Return the single checklist decision and explain outstanding items directly in the summary; the report link supplements that explanation.

Record each reused or new verification's file/command/run URL, diagnostic/outcome, date, candidate/build/configuration identity and selected cases as relevant. Redact secrets, tokens and credentials. Recheck only affected R evidence after a relevant source, dependency, migration, build-input, logger or configuration change; unrelated release/operational work does not change this decision.

## Check results and decision

| Check result | Meaning |
| --- | --- |
| Passed | The applicable listed requirement is met, with inspectable evidence |
| Blocked | A known failure of the listed requirement needs correction |
| Unverified | Evidence for the listed requirement is missing, stale or insufficient |
| Not applicable | The corresponding capability is outside the concrete application scope, with a recorded reason |

Return **Ready to deploy** only when every applicable **R01–R19** check is Passed and every inapplicable item has a concrete reason. Return **Not ready** for any Blocked/Unverified item or unjustified Not applicable result. **The overall decision depends only on R01–R19.** Neither the entire instantiation checklist nor blanket baseline/compliance statements may add a decision gate.

For every Blocked or Unverified item, require:

- Check ID and plain-language requirement.
- Expected versus observed behaviour, or the exact missing evidence.
- Inspectable evidence: file/line, command diagnostic, CI run or verification record. If no verification record exists, state that explicitly and identify the inspected implementation or evidence gap.
- A clear distinction between a known failure and missing evidence.
- Exact corrective action or verification needed.
- Responsible owner where known; otherwise state unassigned/unknown.

The returned summary must name and explain outstanding checks and next actions directly. For example, an **illustrative, unverified** summary might say: “Not ready: R18 requires one deployment example per service. Repository inspection found `apps/api/.env.example` but no `apps/site/.env.example`, a known failure. Add the site example with actual consumers/phases and verify it in isolation; owner unassigned.” Do not present illustrative wording as an actual finding.

The decision applies to the recorded candidate and evidence configuration. Report-only changes do not imply a new application build. A missing publication or unprepared target may still prevent a later operational deployment under its own policy, but cannot change an otherwise passing R01–R19 assessment.

## Separate release and deployment work

Keep release publication, registry images, production provisioning, backup/restore checks, public-site/SEO acceptance, broader product acceptance and live post-deployment actions in their existing procedures and deployment records. Link relevant [manual deployment instructions](../standards/environment-and-deployment.md#manual-production-deployment) as optional context, without adding requirements to this assessment or another readiness stage. Record real live outcomes only after deployment.

An assessment authorises inspection, safe verification and writing its report within the user's task scope. Carry out already-authorised fixes and rerun affected checks. It does not authorise tagging/publishing a release, changing production configuration, consuming production bootstrap/invite tokens or deploying. Deployment remains manual in Dokploy without production Compose.

Keep consumer/skill implementation in its own repository. Maintaining this library must not update consumer repositories or installed plugin snapshots. Existing consumers retain their adopted revision until separately upgraded. Assessment is complete when the report is accurate and actionable, including when its decision is Not ready.
