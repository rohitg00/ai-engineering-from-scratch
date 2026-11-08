---
id: merge-two-scope-contracts
title: Two scope contracts apply to one diff, define the merge
card: agents
kind: design
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [scope-contract, least-privilege, merge-semantics, egress, time-budget]
minutes: 15
lessons: [phases/14-agent-engineering/36-scope-contracts]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops]
related: [agents/a-login-fix-touched-five-files, agents/safe-actions-harmful-trajectory]
updated: 2026-11-03
---

A repository has a project-wide scope contract, and each task adds its own. The checker currently reads whichever file it finds first. Write the merge rule for every field so that the result is mechanical, reviewable and never looser than either input.

## Short answer

Merge by least privilege. Intersect the allowed globs, so that a path must be permitted by both contracts, and union the forbidden globs, so that either contract can prohibit a path. Take the smaller time budget, accumulate the approvals required, and treat the egress allowlist with three states: unset defers to the other side, two lists intersect, and an empty list stays deny-all. Write the rule into the contract schema so that the checker and the reviewer apply the same merge.

## Full answer

### The field rules

| Field | Merge | Reason |
|---|---|---|
| `allowed_files` | Intersection | Both contracts must permit the write |
| `forbidden_files` | Union | Either contract can prohibit |
| `time_budget_minutes` | Minimum | The stricter clock wins |
| `approvals_required` | Union | A sign-off demanded by either is demanded by the merge |
| `network_egress` | See below | Three states, with deny-all absorbing |
| `acceptance_criteria` | Union | Every proof demanded by either must run |
| `rollback_plan` | Both kept | The operator needs each runbook |

### The egress rule in full

`network_egress` has three states. `None` means no enforcement from this contract. `[]` means deny all. A list means an allowlist. Under merge, `None` defers to the other side, two lists intersect, and `[]` on either side yields `[]`. That last point matters: a task contract cannot open the network when the project contract closed it.

### Why the merge is in the schema

A merge rule that lives in the checker's code is invisible to the reviewer who approves the contracts. A rule that lives in the schema is read by the checker, by the reviewer and by the agent. The lesson's framing is that the contract turns "stay in scope" from a wish into a check, and a merge that is not written down is a wish again.

### Severity still comes from the contract

Off-scope writes to documentation are usually a warning, and writes under scripts, migrations or production config are always a block. Under merge, take the stricter severity for a path that both contracts classify. Keep the per-task violation budget, so that small slips surface as warnings and only a budget overrun blocks.

### Where the feature list sits

The feature list bounds the project, and the contract bounds the task. The merged `allowed_files` must sit inside what the active feature touches. If the task contract asks for a path the feature does not cover, the startup check fails before any write.

## Follow-ups

- **Level 3:** The project contract has no egress field and the task contract lists one host. What is the merged egress? Expected: the one-host allowlist, because an unset value defers to the other side.
- **Level 4:** Why intersect allowed globs rather than union them? Expected: a union lets a task contract grant a path the project forbade by omission, and least privilege means both parties must agree on every write.
- **Level 4:** A task legitimately needs a file outside the project contract. What is the path to approval? Expected: an entry in `approvals_required` with a human sign-off recorded, and the project contract updated in review, never a looser merge rule.
- **Level 4:** How do you test the merge? Expected: a table of input pairs and expected outputs for each field, with the deny-all absorption and the unset deferral as named cases, run in CI against the checker.

## Wrong answers

- "Let the task contract override the project contract, because it is more specific." Specific is not the same as safe, and an override lets any task open any path or host.
- "Take the union of allowed files so that nothing legitimate is blocked." A union is the loosest result, and the merge must never be looser than either input.
- "Merge in the checker and keep the contracts simple." A merge the reviewer cannot read is a rule the team cannot audit.

## Taught in

The [scope contracts lesson](../../../phases/14-agent-engineering/36-scope-contracts/) gives the least-privilege merge and the three-state egress rule.
