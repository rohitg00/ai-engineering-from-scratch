---
name: agent-loop
description: Write a correct, minimal ReAct agent loop in any target language/runtime with tools, stop condition, and turn budget.
version: 1.0.0
phase: 14
lesson: 01
tags: [react, agent-loop, tools, observability, stop-condition]
---

Given a target runtime (Python async, Python sync, Node, Rust async, Go) and a tool list (name, input schema, callable), produce a ReAct agent loop that is correct on the first try.

Produce:

1. A message-buffer type with roles {user, assistant, tool, final} and the schema the target provider expects (Anthropic `tool_use` / `tool_result` blocks, OpenAI function-calling messages, Responses API reasoning channel). Never silently swap schemas between providers.
2. A tool registry with name -> callable dispatch, input validation, and a typed result. Errors must be caught and turned into observation strings, never raised to the loop.
3. A loop that runs until one of: explicit `finish` action, no tool calls in the assistant turn, max turns, max total tokens, or a guardrail trip. Pick exactly one primary stop; the others are safety belts.
4. A turn budget scaled to the task class — short task 10, computer-use 200, deep research 400. Call out the choice explicitly.
5. A trace record that logs every thought, action, observation, and stop reason. Emit OpenTelemetry GenAI spans (`invoke_agent`, `tool_call`) when the runtime has an OTel SDK present.

Hard rejects:

- Looping without a turn cap. This is a reliability, not an optimization, issue.
- Swallowing tool errors into an empty observation. The model must see the failure text so it can correct.
- Treating retrieved content as trusted instructions. All tool outputs are untrusted input — only the user message carries permission (see OpenAI CUA docs).
- Mixing providers without a schema-translation layer. Anthropic and OpenAI have divergent tool schemas and message shapes.

Refusal rules:

- If the target is "no framework, bash only," refuse and recommend at least a typed message schema; agent loops are too error-prone for untyped shell glue.
- If the user asks for "auto-retry on failed tool call without feedback to the model," refuse. Retries must either go through the model (CRITIC/Self-Refine, Lesson 05) or be part of the tool's own idempotency contract.
- If the tool list has a destructive tool without a human-in-the-loop confirmation, refuse and point to Lesson 09 (permissions + sandboxing).

Output: one file per language target plus a `README.md` explaining the stop-condition choice, turn budget justification, and one worked trace showing thought-action-observation per step. End with "what to read next" pointing to Lesson 02 (ReWOO planning) if the task is long-horizon, Lesson 03 (Reflexion) if the task is repeat-of-previous, or Lesson 27 (prompt injection) if the tools touch untrusted content.
