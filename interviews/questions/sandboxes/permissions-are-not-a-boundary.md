---
id: permissions-are-not-a-boundary
title: pwd was rejected in one run and ran in the next
card: sandboxes
kind: concept
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [screen, debugging]
tags: [agent-runtime, permissions, safety-mode, hooks, headless]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-permissions-safety-and-hooks, docker-sandboxes-101#s-docker-agent-run-new-and-doctor]
practice: []
cheatsheet: [agent-harness, agent-failure-modes]
related: [sandboxes/hypervisor-is-the-boundary]
updated: 2026-11-03
---

An agent file has `allow: shell:cmd=echo*` and `deny: shell:cmd=rm*`, and the agent runs unattended in CI with `--exec`. A `pwd` call was rejected in one run and ran in another. Explain the decision order, pick the safety mode for an unattended run, and say what permissions do not give you.

## Short answer

A call is decided in order: preempting `pre_tool_use` hooks, then `deny`, then `allow`, then `ask`, then the safety mode on the call's label, then default hooks, then the user. `pwd` matched no pattern and carries the label `safe`, so `strict` asked and the empty terminal turned the prompt into a rejection, while `restricted` allowed it. Pick `restricted` for unattended runs, because it allows `safe` and denies `destructive` and `unknown`. Permissions are enforced by the client; the docs say they stop accidents and are not a security boundary for an agent you do not trust, so isolation needs a sandbox.

## Full answer

### The safety-mode table

| Mode | `safe` | `destructive` | `unknown` |
|---|---|---|---|
| `strict` | ask | ask | ask |
| `balanced` | allow | ask | ask |
| `restricted` | allow | deny | deny |
| `autonomous` | allow | allow | allow |

`--yolo` is `--safety autonomous`. A session that never chooses a mode keeps the older default: read-only tools run without a prompt and every other tool asks. That is why a `wc -l` call asked in a recorded run even though its label was `safe`: the `shell` tool carries `readOnlyHint: false`.

### What the recorded runs showed

Three commands went through `strict` and `restricted` with no terminal. `echo` ran in both because the allow pattern matched. `rm -rf` was refused in both with `Tool 'shell' is denied by permissions configuration.` Only the unmatched `pwd` changed between modes. Patterns from the agent file and from the user's settings merge, and a deny from either side wins.

### What a hook can and cannot change

A `command` hook reads one JSON object on stdin, answers with JSON on stdout, blocks with exit code 2, and times out after 60 seconds by default. A hook marked `preempt_yolo` runs first and no mode or allow rule can bypass its deny or ask. Its allow is only advice: the recorded hook printed `permission_decision: allow` on all three calls, and `rm` was still denied and `strict` still asked for `pwd`. Two builtin transform hooks run on every call because `redact_secrets` is on by default. When one message asked for three commands, the hook ran three times at once and two runs wrote to the log together, so write each record in one write.

### The headless failure

With `--exec` and no terminal, `tool_call_confirmation` has nobody to answer it. The tool result becomes `The user rejected the tool call.`, and the model routes around it or repeats itself. An unattended run therefore needs `restricted` plus explicit `allow` rules for the tools it must call.

## Follow-ups

- **Level 2:** Why did a read-only command prompt when no mode was set? Expected: the old default allows read-only tools only, and `shell` declares `readOnlyHint: false`, so its label does not help.
- **Level 3:** A preempting hook returns allow for an `rm` call. Does it run? Expected: no; an allow from a preempting hook is advice, and the deny pattern blocks the call.
- **Level 3:** Your hook log has interleaved half-lines. What happened? Expected: several hook instances ran at once for one message; append each record with a single write.
- **Level 4:** What does `restricted` leave uncovered? Expected: anything that does not pass through the runtime, a tool whose label is wrong, and the host itself; run the agent in a sandbox for isolation.

## Wrong answers

- "`restricted` is a security boundary, so the host is safe." The docs call it an extra layer against unwanted calls, enforced client-side.
- "Use `autonomous` in CI so nothing blocks." It allows `destructive` calls too; `restricted` fails closed on them.
- "A hook can grant a call that `deny` blocks." A deny from any side wins, and a hook's allow is advice.

## Taught in

The [permissions section](../../../manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md) records the two modes and the hook input, and the [run section](../../../manuals/docker-sandboxes-101/sections/5-1-docker-agent-run-new-and-doctor.md) shows the headless confirmation that became a rejection.
