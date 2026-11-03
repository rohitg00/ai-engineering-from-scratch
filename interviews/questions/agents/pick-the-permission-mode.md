---
id: pick-the-permission-mode
title: Pick the permission mode for the task in front of you
card: agents
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, design-review]
tags: [permission-modes, autonomy, classifier, budgets, isolation]
minutes: 8
lessons: [phases/15-autonomous-systems/10-claude-code-permission-modes]
manuals: []
practice: []
cheatsheet: [autonomous-agents, coding-agents]
related: []
updated: 2026-11-03
---

A coding agent offers six permission modes, from one that asks before every action to one that approves everything. A colleague runs every task in the mode that approves everything, because the prompts are annoying. Give the rule you use to pick a mode, and say which tasks go where.

## Short answer

Pick the mode from the task, not from the annoyance. Start an unfamiliar or production-adjacent task in plan mode, where reading the plan is cheaper than undoing a bad run. Use the default mode for most interactive sessions, and the mode that auto-approves file writes for a known refactor across many files. Reserve the classifier-driven auto mode for unattended runs inside a workspace whose reach you have measured, and reserve the approve-everything mode for a disposable container.

## Full answer

### The ladder

| Mode | Behavior | Fits |
|---|---|---|
| `plan` | The agent proposes a plan, and every action is reviewed before it runs | An unfamiliar task, code near production, the first run on a repo |
| `default` | Actions run, and the agent asks on anything risky such as shell, destructive operations or network | Most interactive sessions |
| `acceptEdits` | File writes are approved, and shell and network still ask | A refactor across many files |
| `auto` | A separate classifier model reviews each action and blocks escalation beyond the request | A long unattended run in a constrained workspace |
| `dontAsk` | Never prompts, and anything not pre-approved by a rule is denied | Ephemeral sandboxes, CI jobs |
| `bypassPermissions` | Approves everything | Only a container you are willing to throw away |

### What the classifier mode adds and misses

The auto mode moves approval off the user's path. A separate model judges each proposed action against the declared task and the session state, and a blocked action falls back to the user. It catches plain prompt injection that maps to a known risky action shape, repeated tool loops where action N+1 looks like action N five times in a row, and shell commands that are out of place in a file-edit session. It misses subtle injection that changes behavior without one flagged action, and it misses a harmful trajectory made of individually safe actions, because it judges the action and does not re-derive the user's intent. Availability depends on plan, organization, model and provider, and the documentation is explicit that the classifier is a layer, not a solution.

### Budgets travel with the mode

Whatever the mode, set the budget controls: a cap on turns, a dollar cap that aborts the session, and action-count limits per tool. In the unattended case, add an allowlist, an isolated workspace with no credentials and no production mounts, and a trajectory audit afterwards.

### The answer to the colleague

The approve-everything mode is documented for a disposable container. On a laptop with credentials, a browser session and an open terminal, the attack surface is everything the agent can reach. The prompts are the control, and the fix for too many prompts is a mode one step up the ladder, not the top of it.

## Follow-ups

- **Level 2:** Why does the refactor mode still ask on shell commands? Expected: a file write is reversible from version control, while a shell command can delete, send or install, so the mode approves the cheap-to-undo class only.
- **Level 2:** How does the never-prompt mode differ from the top of the ladder? Expected: the never-prompt mode denies anything that a rule did not pre-approve, while the approve-everything mode approves it.
- **Level 3:** An unattended run needs a 24-hour budget. What do you set? Expected: a turn cap, a dollar cap, per-tool action caps and an allowlist, each with a reason, inside a workspace with no credentials and no egress you did not opt into.
- **Level 3:** The classifier approved every action and the run still exfiltrated data. How? Expected: a sequence of allowed actions, such as writing data you own to a file and then pushing to a public repository, where the composition is the problem and no single action was flagged.

## Wrong answers

- "Approve everything, because the agent is in version control anyway." Version control covers file writes, and the risk is in shell, network and credentials, which no commit reverts.
- "The classifier mode is safe for anything, because a model reviews each step." The classifier judges actions, not trajectories, and the documentation pairs it with budgets, allowlists and isolation.
- "Plan mode is for beginners." Plan mode is for the task where a wrong run costs more than a read, and that is a property of the task, not of the operator.

## Taught in

The [permission modes lesson](../../../phases/15-autonomous-systems/10-claude-code-permission-modes/) lays out the six modes, the classifier and the budget controls.
