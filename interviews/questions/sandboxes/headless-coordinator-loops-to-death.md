---
id: headless-coordinator-loops-to-death
title: Five identical calls, five rejections, exit 1
card: sandboxes
kind: debug
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, coding]
tags: [agent-runtime, headless, sub-agents, permissions, regression]
minutes: 12
lessons: []
manuals: [docker-sandboxes-101#s-sub-agents-transfer-task-and-background-agents, docker-sandboxes-101#s-permissions-safety-and-hooks, docker-sandboxes-101#s-session-db-sessions-diff-and-eval]
practice: []
cheatsheet: [agent-harness, agent-failure-modes]
related: [sandboxes/permissions-are-not-a-boundary]
updated: 2026-11-03
---

A coordinator agent runs in CI with `--exec --json`. The event stream shows the same `run_background_agent` call five times, each answered with `The user rejected the tool call.`, then `Error: Agent terminated: detected 5 consecutive identical calls to run_background_agent`. The same agent file worked on a laptop that morning. Explain the chain, fix it for unattended runs, and add the check that would have caught the change before CI did.

## Short answer

Headless means nobody is there to answer a `tool_call_confirmation`, so the runtime turned the prompt into a rejection; `run_background_agent` prompted because its label is `unknown`, the file set no safety mode, and no `allow` pattern named it, and the model repeated the call until `max_consecutive_tool_calls`, whose default is 5, ended the run with exit 1. Fix it with `--safety restricted` plus `allow` rules for `run_background_agent` and for the tools the background sub-agent itself calls, because inside a running task a call that would ask is denied automatically; `transfer_task` needs nothing, since it is the one tool always approved without a prompt. Guard it with two recorded sessions and `docker-agent sessions diff --fail-on-divergence -- -1 -2`, which compares tool calls, ignores prose and stops at the first divergence.

## Full answer

### Three ways to involve another agent

| Mechanism | Added by | What happens |
|---|---|---|
| `transfer_task` | `sub_agents` | the child runs in a clean sub-session with a system message holding the task, returns its answer as the tool response, and never sees the user's history |
| `handoff` | `handoffs` | the named agent becomes the active agent for the rest of the conversation and sees the whole history |
| `run_background_agent` | the `background_agents` toolset | starts a task and returns an id at once; `list`, `view` and `stop` follow it |

`transfer_task` is always approved without a prompt. A delegation to an agent already in the chain fails, and nesting is capped at 10. A `sub_agents` entry that is a registry reference resolves its tag again on every run unless pinned to a digest, which is a second way a laptop run and a CI run differ.

### Why the laptop passed

The laptop had a terminal. The same confirmation appeared and a person approved it, or the session had been given a mode. A session that never chooses a mode keeps the old default: read-only tools run and every other tool asks. In CI the ask has no answerer, the rejection goes back to the model as a tool result, the model does not change its plan, and the loop detector stops the run. `session.db` stores `safety_policy` per session, so you can read afterwards which mode each failed run had.

### The fix, in order

1. `--safety restricted`, so unmatched `safe` calls run and `destructive` and `unknown` calls fail closed instead of prompting.
2. `allow` patterns for `run_background_agent` and for the tools the background sub-agent uses, because inside a running task a call that would normally ask is denied automatically.
3. Keep `deny` for anything destructive; no mode and no hook allow overrides a deny.
4. Pin external sub-agent references to a digest.
5. Run the agent in a sandbox for isolation, because permissions are enforced by the client.

### The regression check

Record a run with `--record=PATH` and `--models-gateway`, replay with `--fake`, and compare two sessions with `sessions diff`. The help's own example fails because the parser reads `-1` as a flag; put `--` before the references. A recorded pair of identical replays reports identical behaviour across all turns, and a run that called a different tool first diverges at turn 0 and exits 1 with `--fail-on-divergence`. Ask for one tool call per message when you record, because a turn with two parallel calls appends results in completion order and the replay answers with `requested interaction not found`.

## Follow-ups

- **Level 3:** Why does `transfer_task` not need an `allow` while `run_background_agent` does? Expected: delegation is always approved by design, and a background start is a normal tool call that the mode and the patterns decide.
- **Level 3:** `sessions diff -1 -2` fails with an unknown shorthand flag. Why, and what do you type? Expected: the parser reads `-1` as a flag; `sessions diff -- -1 -2`.
- **Level 4:** The writer sub-agent is pulled from a registry by tag rather than read from a file. What can change between the laptop and CI? Expected: the tag resolves again on every run, so pin a digest.
- **Level 4:** Why compare tool calls and not the assistant text? Expected: a live model words every answer differently, while the sequence of tool calls is the behaviour you shipped.

## Wrong answers

- "Use `--yolo` in CI so nothing prompts." That is `autonomous`; destructive calls run too. `restricted` fails closed on them.
- "Raise `max_consecutive_tool_calls`." It hides the loop; the rejection is the fault, and the detector did its job.
- "Diff the transcripts." Prose varies between runs; `sessions diff` compares the tool-call sequence and stops at the first divergence.

## Taught in

The [sub-agents section](../../../manuals/docker-sandboxes-101/sections/5-4-sub-agents-transfer-task-and-background-agents.md) records the rejected background call and the loop detector, the [permissions section](../../../manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md) gives the mode table and the order, and the [sessions section](../../../manuals/docker-sandboxes-101/sections/5-6-session-db-sessions-diff-and-eval.md) shows `sessions diff` and the replay rules.
