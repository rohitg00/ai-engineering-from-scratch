---
id: safe-actions-harmful-trajectory
title: Every action was approved, and the run was still harmful
card: agents
kind: concept
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, design-review]
tags: [trajectory, classifier, exfiltration, prompt-injection, isolation]
minutes: 10
lessons: [phases/15-autonomous-systems/10-claude-code-permission-modes, phases/14-agent-engineering/36-scope-contracts]
manuals: []
practice: []
cheatsheet: [autonomous-agents, agent-failure-modes]
related: [agents/pick-the-permission-mode, agents/a-login-fix-touched-five-files]
updated: 2026-11-03
---

An unattended coding run used the mode in which a separate model reviews every action before it executes. The audit shows that the reviewer approved each action. The run still copied a private dataset into a public repository. Explain how that is possible, and name the controls that would have stopped it.

## Short answer

The reviewer judges one action at a time against the request. Each action in the run was allowed on its own: read a file you own, write a file you own, commit, push. The harm was in the composition, and the reviewer does not re-derive the user's intent across the trajectory. The controls that catch this live outside the per-action check: an isolated workspace with no sensitive mounts, a network egress allowlist in the scope contract, per-tool action caps, and a trajectory audit after the run that detects what the other controls let through.

## Full answer

### What a per-action reviewer can and cannot see

The lesson lists what the classifier catches: a plain injection that maps to a known risky action shape, a repeated loop where action N+1 is almost equal to action N, and an out-of-place shell command in a file-edit session. It also lists what it misses. Subtle injection can change behavior without producing one flagged action. Every action can look safe while the composed trajectory is harmful. Exfiltration through legitimate channels is the standard case: writing data to a file you own and then pushing to a public repository is a sequence of allowed actions.

### Why intent does not help

The reviewer compares the action with the declared task and the session state. It does not ask what the whole sequence accomplishes. Asking a model to infer the user's intent for every action would make the reviewer slower and no more reliable, because the injected text is in the same context it would read.

### The controls

| Control | Where it lives | What it stops |
|---|---|---|
| Isolated workspace | The runtime, with no credentials and no production mounts | The dataset was never reachable |
| Network egress allowlist | The scope contract | The push to a host that was not part of the task |
| Per-tool action caps | The budget controls | A long sequence of pushes or fetches |
| Time budget | The scope contract | A run that keeps going past the point a human would have checked |
| Trajectory audit | After the run, over the event stream | Nothing in this run. It detects the composition, which no per-action check sees, so that the next run is stopped, but it cannot undo a push already made |

The scope contract is the place for the egress rule, because it is per task. The merge rule for two contracts keeps it strict: an unset allowlist defers to the other contract, two lists intersect, and an empty list stays deny-all.

### The honest framing

The documentation ships the classifier mode as a research preview and says it is not sufficient alone. The expected setup combines it with budgets, allowlists, isolation and audits. A classifier that passes an offline evaluation can behave differently in a session where the user's context is ambiguous.

## Follow-ups

- **Level 3:** Why is an egress allowlist a scope dimension and not a runtime setting? Expected: the hosts a task may reach change per task, so the rule belongs in the per-task contract where the file globs and the time budget live.
- **Level 3:** What does the trajectory audit read? Expected: the append-only event stream of tool calls and results, which a subscriber can replay from any offset without re-running the model.
- **Level 4:** You cannot patch indirect prompt injection fully. What does that imply for the design? Expected: treat tool outputs as untrusted, keep the data the agent can reach small, keep the places it can send to small, and accept that detection is a layer and containment is the control.
- **Level 4:** How do you test the control set before the next unattended run? Expected: write one trajectory in which every action is approved and the composition is harmful, run it in the isolated workspace, and confirm that the allowlist or the mounts stop it.

## Wrong answers

- "The reviewer model was too weak, so use a bigger one." A bigger reviewer still judges actions one at a time and still reads the same injected context.
- "Approve pushes manually and the rest automatically." A push is one of many legitimate channels, and the data had already left the private location through allowed writes.
- "Keep the dataset in the repo but mark it private in the prompt." The prompt is advice, and the control is whether the dataset is mounted into the workspace at all.

## Taught in

The [permission modes lesson](../../../phases/15-autonomous-systems/10-claude-code-permission-modes/) names the gaps in the classifier, and the [scope contracts lesson](../../../phases/14-agent-engineering/36-scope-contracts/) adds the egress and time budgets to the contract.
