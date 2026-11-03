---
id: five-identical-calls
title: Five identical calls and a run that ended itself
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [agents, tool-calls, permissions, background-agents, degenerate-loop]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: [docker-sandboxes-101#s-sub-agents-transfer-task-and-background-agents, docker-sandboxes-101#s-permissions-safety-and-hooks]
practice: []
cheatsheet: []
related: [scenarios/denied-by-policy-or-by-the-user]
updated: 2026-11-03
system:
  version: docker-agent v1.149.0 and sbx v0.47.0
  model: ai/qwen3:4b through the local model runner, at temperature 0
  hardware: one Mac, no GPU
source:
  - manuals/docker-sandboxes-101/capture/fixtures/agents/team.yaml
  - manuals/docker-sandboxes-101/capture/out/19-transcript.txt
  - manuals/docker-sandboxes-101/capture/out/19-background.txt
  - manuals/docker-sandboxes-101/capture/out/19-background.ndjson
  - manuals/docker-sandboxes-101/sections/5-4-sub-agents-transfer-task-and-background-agents.md
  - manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md
---

## Situation

A coordinator agent runs in a nightly job with `--exec`, and nobody watches a terminal. Its agent file gives it one sub-agent, a writer, and the `background_agents` toolset, so that it can start the writer in the background, wait, and repeat the writer's sentence. The job has worked for weeks when the coordinator used `transfer_task`. A teammate changed the user message to ask for a background agent, and the next run stopped with exit 1 and the line `Agent terminated: detected 5 consecutive identical calls to run_background_agent`.

The teammate reads the line as a runtime bug: the model was working, and the runtime killed it. The proposed fix is to raise the limit on repeated calls and to swap the model. You review the run before either change ships.

## Evidence

- [the coordinator agent of the team file](evidence/the-team-file.txt)
- [the same coordinator one run earlier, with transfer_task](evidence/a-delegation-that-needed-no-approval.txt)
- [the user message, the first background-agent call, and what came back](evidence/the-first-call-and-its-answer.txt)
- [the next five calls and their five answers](evidence/five-more-rounds.txt)
- [one round in the event stream, from the tool call to the next message](evidence/one-round-in-the-event-stream.txt)
- [the last line of the run](evidence/the-termination.txt)
- [what each safety mode does with a call that no pattern matched](evidence/the-safety-modes.txt)

## Questions

1. Before you open the event stream, list what the model could have received after its first call, and what a well-behaved agent does with each answer.
2. The runtime asked for a confirmation six times, and nobody answered. Why did the asks happen, and what turned each ask into a rejection?
3. Compare the arguments of the six calls. What changed after the first round, and what does that tell you about how the model read the answer?
4. Name the gate that ended the run, its default, and why the same agent file worked one run earlier.
5. Write the change to the agent file or the command that lets a headless coordinator start a background agent, and say what you would leave as it is.

## Walkthrough

1. **Read the agent file.** The root agent has `max_iterations: 6`, `sub_agents: [writer]`, `handoffs: [reviewer]`, and one toolset of type `background_agents`. The file has no `permissions` block, and the command chose no safety mode. So any call that is not approved by default has to ask someone.
2. **Read the first round.** The runtime raised `tool_call_confirmation` for `run_background_agent`, with `safety_label` `unknown` in the metadata. Under `--exec` there is no terminal to answer, so the runtime turned the question into a refusal. The tool response went back to the model as plain text: `The user rejected the tool call.`
3. **Read the five rounds after it.** The model sent the same call again, five times, with the same agent and the same task. It dropped `expected_output` after the first round and changed nothing else. A rejection is a final answer about that call. The model treated it as a transient error and retried.
4. **Read one round in the event stream.** The tool call carries `safety_label: unknown`. The two hook events are `tool_input_transform` and `tool_response_transform`, the built-in transforms, and both report `allowed: true`. No `pre_tool_use` hook and no allow pattern decided anything. The result has `isError: true`, then `message_added`, and the next model turn starts from the same state.
5. **Read the last line.** The runtime stopped the run after five identical calls in a row. The manual names the limit, `max_consecutive_tool_calls`, and a value of 0 means the default of 5. The runtime caught a loop that the model did not. One run earlier the same coordinator called `transfer_task`, which is the one tool that is always approved without a prompt, so that run raised no confirmation.
6. **Read the safety-mode table.** A run that chose no mode keeps the old default: read-only tools run, and every other tool asks. The background-agent tool is not read-only and its label is `unknown`. Under `restricted` an unknown label is denied, and under `strict` or `balanced` it asks again. Only an `allow` pattern or `autonomous` lets the call through. The manual adds that inside a running task, a call that would ask is denied automatically, so a headless coordinator needs an allow rule for `run_background_agent` and for the tools its sub-agents call.

## Resolution

The cause is a headless run with a tool whose label is `unknown` and no allow pattern. Every call asked, every ask became a rejection, and the model repeated the call. The repeat limit worked as designed: it turned an endless loop into one exit code.

The fix is a permission, not a higher limit. Add an `allow` pattern for `run_background_agent` to the agent file, and allow patterns for the tools the writer will call, then rerun with `--exec`. The manual did not run the repaired configuration, so the check is yours: the first `run_background_agent` call must return a task id in the stream instead of a rejection, and the run must end with the writer's sentence and exit 0. Keep the limit at its default. Keep the safety mode out of `autonomous`.

The proof that the permission was the cause is already in the stream: every round shows a confirmation with no one to answer it, a result with `isError: true`, and no rule or hook in the decision. The run with `transfer_task` on the same file shows the other side: a tool that needs no approval ran once and returned.

## Wrong turns

- "Raise the limit on consecutive calls so the run can finish." Every call hit the same rejection. More rounds give more rejections, and the limit is the only thing that ended the run.
- "Run the job with `--yolo`." That is `--safety autonomous`: every tool is allowed, including every tool of the sub-agents. One allow pattern for one tool is the smaller change.
- "The model is at fault, swap it." The model received an error string and nothing else. Another model can retry the same way, and the runtime holds the gate for that reason. Check the permission before the model.
- "Add a `pre_tool_use` hook that answers allow." From a preempting hook, an allow verdict is advice. The hook can deny or ask, and it cannot grant.

## Generalize

A tool result that returns to the model as text is an input the model may ignore. When a run has nobody to answer a question, give the agent explicit allow patterns for the tools it must call and nothing more, and keep the runtime limits that stop a repeated step. Read a termination line as a gate that worked, then find the reason the model needed it.

## Taught in

[The sub-agents section](../../../manuals/docker-sandboxes-101/sections/5-4-sub-agents-transfer-task-and-background-agents.md) records this run, [the permissions section](../../../manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md#the-order-and-what-a-hook-can-change) gives the decision order, and [the failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names a repeated step as a failure to gate.
