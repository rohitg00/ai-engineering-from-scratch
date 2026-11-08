---
id: why-the-gate-has-no-model
title: Why the verification gate has no model in it
card: agents
kind: concept
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, ml-depth]
tags: [verification-gate, deterministic, llm-judge, override-log, defense-in-depth]
minutes: 10
lessons: [phases/14-agent-engineering/38-verification-gates]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, eval-driven-agents]
related: [agents/tests-passed-but-nothing-ran, agents/rules-the-workbench-can-check]
updated: 2026-11-03
---

A proposal replaces the script that decides whether an agent task is done with a model judge. The argument is that a judge reads the diff, understands intent, and catches more than a script can. Argue for or against, and say where a judge does belong.

## Short answer

Against. The gate answers one question, is this task complete, and that verdict must be the same for the same artifacts every time, in version control, in CI, with no way for the agent to argue with it. A model judge gives a different answer on a different day and can be talked into a pass. A judge belongs on the review side, where the question is qualitative: is the code readable, secure and on style.

## Full answer

### What the gate reads and decides

| Check | Source | Severity |
|---|---|---|
| Every acceptance command ran | feedback records | block |
| Every acceptance command exited zero | feedback records | block |
| No write to a forbidden path | scope report | block |
| No off-scope write | scope report | block or warn |
| Every block-severity rule passed | rule report | block |
| No null exit code | feedback records | block |
| Touched files match the allowed globs | both | warn |

A warn annotates the verdict. A block prevents `passed: true`. Every check is a comparison between artifacts the agent already produced. No judgement is needed, so no judge is needed.

### Why determinism is the point

Three failure shapes dominate agent work: "looks good", "tests passed" with no record, and acceptance read loosely enough to mean anything. A model judge is subject to all three. It reads the diff and decides it looks good. It reads the transcript and believes the claim. It interprets the acceptance line generously. The script cannot do any of that, because it never reads prose. The lesson pairs the two kinds of signal: verifiable checks such as tests, schema checks and exit codes answer whether the code solved the problem, and rubric judges answer whether it is readable and on style. Mixing them collapses the signal.

### Overrides are human and signed

A block cannot be overridden by the agent. A human can override it, and the override writes a row with the finding code, a reason, the signing user and the current commit into an audit log that git tracks. The runtime refuses an override without a signature. That is the line between an override policy and an override theater.

### One report, several layers

The gate writes one `verification_report.json` per task under one path, and CI reads the same path. Around it sit other deterministic layers: a pre-commit hook, a CI status check, a pre-tool authorization hook and a pre-merge gate. A failure in one layer is caught by the next. The pre-commit hook does not depend on the agent following instructions, but it is a local check that `git commit --no-verify` skips, so the CI status check and the pre-merge gate hold the verdict.

### Where the judge goes

The reviewer, a separate pass with a different role, reads the diff and the reports after the gate passes. It scores readability, security and style. Its output goes to a human or into the handoff, never into the gate's verdict.

## Follow-ups

- **Level 3:** An agent deletes failing tests, and the gate stays green. Which check is missing? Expected: a coverage floor read from a coverage report, with a block when coverage falls below the floor or drops by more than one percentage point against the previous merge.
- **Level 3:** When is promoting every warning to a block the right default? Expected: on release branches and in post-incident triage through a strict flag, and not globally, because strict everywhere erodes daily flow.
- **Level 4:** What stops the override log from becoming a formality? Expected: the runtime refuses an unsigned entry, the log is in git, and review reads it, so every override has a name and a reason attached.
- **Level 4:** The gate and the reviewer disagree. Who wins? Expected: the gate decides whether the task is done, and the reviewer decides whether it is good, so a gate failure blocks regardless of the review, and a review failure reopens the task without touching the verdict.

## Wrong answers

- "A judge understands intent, so it catches more." The gate does not need intent, and a judge that infers intent can be convinced that an incomplete task is complete.
- "Run the judge and the script, and pass if either passes." The judge then becomes the way around the script, so the deterministic checks must decide done and the judge must only annotate.
- "Let the agent explain why a block does not apply." The agent is the party under test, and an override needs a human signature with a reason.

## Taught in

The [verification gates lesson](../../../phases/14-agent-engineering/38-verification-gates/) builds the deterministic gate, the signed override log and the coverage floor.
