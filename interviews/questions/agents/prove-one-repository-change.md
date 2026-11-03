---
id: prove-one-repository-change
title: Bring evidence for one agent-assisted change
card: agents
kind: take-home
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [take-home, design-review]
tags: [evidence, baseline, acceptance-check, rollback, intervention-log]
minutes: 60
lessons: [phases/14-agent-engineering/42-agent-workbench-capstone]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, eval-driven-agents]
related: [agents/ship-a-workbench-pack, agents/green-gate-missing-tests]
updated: 2026-11-03
---

Take-home. Pick a small real change in a repository you may modify, and let one coding agent make it. Bring back evidence that a reviewer can reproduce, not a transcript. Tell us what you would record at each step, how you would prove that your acceptance check can fail, and what you would refuse to claim.

## Short answer

Record the starting revision, the observable goal, the non-goals, the allowed paths and the acceptance evidence before the agent runs, together with the working mode, the budget and a stop condition. Capture a baseline with the closest existing check before any edit. After the change, write the expected result independently of the implementation, introduce one deliberate wrong result in a disposable copy, and show that the same check fails for that reason. Label every runtime observation as local, staging or live, rehearse a rollback, and leave the branch, the changed files, the open risks and the next action explicit.

## Full answer

### Frame the task and the autonomy

Write down the starting revision, the goal as something observable, the non-goals, the allowed paths and the evidence that will count as acceptance. Name the real user or operator who needs the behavior. Choose a working mode, guided steps, checkpointed implementation or a bounded autonomous run, and say why the uncertainty, the consequences and the reversibility justify it. Set a wall-time budget and a token or cost limit where the agent exposes one. Define the stop condition for repeated failure, a request for new permissions, budget exhaustion or an unresolved contract decision, and name who resolves it.

### Prepare the smallest environment

Retrieve the implementation, its caller, its test and the local instructions, and record why each belongs in context. Make one explicit choice per extension: a skill for a repeatable procedure, a tool for access, a hook for a deterministic check, a plugin for packaged capabilities, each with the least permissions that let it work. Record one proposed addition you rejected and its cost. Recheck one stale note or instruction and retire it if the evidence supports that.

### Baseline, then implement

Before any edit, run the closest existing check and record the command, the revision, the result and where the evidence lives. A feature that does not exist yet still has a baseline: the observed response or the unsupported operation. Then let the agent work inside the contract, and keep an intervention log with the reason for each correction, permission change or plan revision.

### Challenge the evidence

Pick proof that observes the changed surface: the served page at the relevant widths for a UI, the request and the serialized response for an API, the built command with its exit code for a CLI. Write the expected result from the task contract without reading the implementation. In a disposable copy, introduce one specific incorrect result, such as accepting an invalid value or dropping a required field, and run the same acceptance check. It must fail for that reason. If it stays green, strengthen the assertion before you trust it. Restore, rerun, and keep both receipts. A syntax error or a broken test setup does not count as detecting the regression. Ask a peer or a separate reviewer session to challenge the weakest proof without editing the implementation.

### Rehearse operation and recovery

Run the artifact in a disposable local or staging environment and label every observation local, staging or live with the exact revision. Choose one failure signal for the task, with a threshold, an observation window and an owner, and trigger it safely. Rehearse the rollback to a known-good artifact and check that the old behavior returns, including any persistent data. Record any recovery step you could not verify.

### Improve the next run and hand off

Compare the result with the baseline, including elapsed time, usage data and human interventions. One task shows what happened on that task, not that an agent is generally faster. Promote one observed correction into a test, a smaller permission or an automation, and rerun the affected check. Remove temporary changes and leave the final branch, the changed files, the open risks and the next action explicit.

### The rubric

Each row gets `demonstrated`, `needs revision` or `unverified`, with an evidence pointer and a reason. The reviewer reproduces at least the weakest acceptance check. Filled fields and passing scripts are not substitutes for the observations. Leave unavailable evidence as unverified and narrow the claim, and never present the result as a hiring or deployment guarantee.

## Follow-ups

- **Level 3:** Your planted regression passed the acceptance check. What do you do? Expected: treat the check as untrustworthy, strengthen the assertion or the observation until it fails for that reason, and only then rerun the correct version.
- **Level 3:** Why must each runtime observation carry an environment label? Expected: a local rehearsal supports a local claim only, and an unlabeled observation lets a reader read a laptop run as production evidence.
- **Level 4:** The agent finished faster than your baseline. What may you claim? Expected: that this task was faster on this run with this many interventions, and nothing about agents in general.
- **Level 4:** Which single row would you mark unverified rather than fake? Expected: any row whose evidence you could not observe, such as a recovery step that needs a production mount you do not have, with the claim narrowed to match.

## Wrong answers

- "The transcript shows the agent running the tests, so that is the evidence." A transcript is what the agent said, and the evidence is the check, its exit code and the record a reviewer can rerun.
- "The acceptance check passed, so the change is proven." A check that never failed proves nothing, and the deliberate wrong result is what shows the check can detect a regression.
- "Deployment to production is required to complete the exercise." A labeled local or staging rehearsal supports a local claim, and the exercise asks for honest labels, not production access.

## Taught in

The [workbench capstone](../../../phases/14-agent-engineering/42-agent-workbench-capstone/) gives the six steps and the manual review rubric for the evidence.
