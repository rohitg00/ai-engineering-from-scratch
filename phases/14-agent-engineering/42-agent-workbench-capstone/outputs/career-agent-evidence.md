# Agent-Assisted Engineering: Task Evidence

Copy this template into your own repository under `learning-artifacts/`. Replace the prompts with actual observations and relative evidence paths. Keep private data and secrets out of the evidence. Mark missing evidence `unverified`; never replace it with an invented result.

## Task contract

- Repository and starting revision:
- Learner and intended user or operator:
- Coding agent and relevant configuration:
- Observable goal and non-goals:
- Allowed paths and actions requiring approval:
- Task frame and dependency-aware plan:
- Acceptance claim and independently defined expected result:

## Autonomy and environment

- Working mode and reason, considering uncertainty, consequences, and reversibility:
- Wall-time budget; token or cost limit if available:
- Stop or escalation conditions, next action, and decision owner:
- Selected implementation, caller, tests, and instructions, with reasons:
- Tool or extension retained, task need, permissions, and context cost:
- Proposed skill, MCP tool, hook, or plugin rejected, with reason:
- Stale memory or instruction rechecked, current source, and retirement or replacement decision:
- Check rerun after that decision and its evidence:

Use only extensions this task needs. Record unavailable usage measurements as unavailable. A decision to retain a revalidated instruction is valid when removing it would lose a necessary constraint.

## Baseline and implementation

| Run | Revision or artifact | Exact command or observed journey | Actual result | Evidence path |
|---|---|---|---|---|
| Before the change | | | | |
| After the change | | | | |

- Why the selected proof observes the changed UI, wire response, CLI, or other surface:
- What that proof does not establish:
- Agent interventions, failed attempts, or contract changes, with reasons:
- Final changed-file list and diff:

## Test the acceptance check

Use a disposable copy. Introduce one wrong behavior from the task contract without breaking the test runner. Keep the acceptance check unchanged for the first challenge.

- Deliberately incorrect result:
- Expected assertion or observation that should reject it:
- Actual failure, exact command, revision, and evidence path:
- If the incorrect result passed, what made the check too weak and how it was improved:
- Restored correct result, passing rerun, and evidence path:
- Confirmation the deliberate mutation is absent from the final diff:

A syntax error, missing dependency, or failing setup is not evidence that the check detects the behavioral defect.

## Independent review

- Peer or separate reviewer session:
- Evidence and diff inspected, including test changes:
- Weakest acceptance check challenged or reproduced:
- Findings, changes made, and remaining disagreements:

## Operation and recovery

- Environment: `local`, `staging`, or `live`:
- Running revision or artifact identity and observation time:
- Failure signal, threshold, observation window, owner, and response:
- Safe failure injection and observed evidence:
- Known-good rollback target and recovery procedure:
- Rollback rehearsal, restored behavior, and evidence:
- Persistent-data implications, if any:
- Unverified operational behavior and limits on the claim:

Local rehearsal is sufficient for this exercise. Label it accurately and do not imply that it proves production behavior.

## Iteration and handoff

- Baseline versus final outcome:
- Actual elapsed time, available usage data, and human interventions:
- One correction promoted to a durable control:
- Rerun proving the control works:
- Final branch and revision, deliberate uncommitted work, and artifact locations:
- Temporary changes removed, open risks, and remaining blockers:
- Next action and the command or evidence the next session should start with:

## Reviewer decision

Inspect the referenced artifacts and reproduce the weakest acceptance check. Use `demonstrated`, `needs revision`, or `unverified`, with a reason. This is a manual evidence review, not a score for completing prose fields.

| Dimension | Status | Evidence inspected and reason |
|---|---|---|
| Task contract and justified autonomy | | |
| Context, tools, and retirement decision | | |
| Before/after proof and rejected incorrect result | | |
| Diff review and operational recovery | | |
| Verified improvement and clean handoff | | |

- Defensible completion claim:
- Required revisions or unverified limits:
