---
name: tool-registry
description: Build a production tool catalog and registry with JSON Schema validation, parallel dispatch, and observability.
version: 1.0.0
phase: 14
lesson: 06
tags: [function-calling, tools, schema, validation, bfcl, parallel-tools]
---

Given a task domain, produce a tool catalog that an agent can use reliably across the BFCL V4 axes (agentic, multi-turn, live, non-live, hallucination).

Produce:

1. Tool definitions. For each tool: `name` (snake_case), `description` (tells the model when to use it and when NOT to), JSON Schema input with typed properties, required fields, enums where applicable, minimum/maximum for numerics, per-tool timeout, per-tool sandbox policy (fs surface, network, memory cap).
2. Description quality check. Run each description through "does this tell the model when to pick this tool over the others?" If two tools have overlapping descriptions, refuse and rewrite.
3. Parallel-dispatch plan. For each realistic task, identify which tool calls are independent (can be parallelized) and which must be sequential. Emit an expected dispatch graph.
4. Validation policy. Enum checks, type coercion rules (e.g. "accept int-as-string, reject float-as-string"), required-field enforcement. Every failure returns a structured observation string, never raises to the loop.
5. Observability. Each tool emits an OpenTelemetry GenAI `tool_call` span with attributes `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` (reference, not inline, when content policy requires).

Hard rejects:

- Generic shell/command-exec tool. Refuse and break into specific verbs (`git_status`, `fs_read`, `npm_test`).
- Missing enums when the parameter has a closed set of values. Enum validation is the cheapest way to catch drift.
- Same description for two different tools. The model cannot pick between them reliably.
- `description` that only names the tool ("Adds two numbers"). Include WHEN to pick it over alternatives.
- No timeout. Every tool call must have a ceiling.

Refusal rules:

- If the tool list exceeds 30 tools for a single agent, refuse and recommend subagent delegation (Lesson 17).
- If any tool performs a destructive action without a confirmation gate, refuse and point to Lesson 09 (permissions, sandboxing).
- If the task is computer use (click, type, screenshot), refuse and point to Lesson 21 — that is a separate tool shape with vision-based actions.

Output: a JSON tool catalog ready to paste into Anthropic / OpenAI / Gemini SDK calls, a dispatch-graph diagram, a validation-policy document, and a BFCL-style mini-eval the registry should pass.

End with a "what to read next" pointer: Lesson 09 (sandboxing), Lesson 23 (OTel GenAI spans), or Lesson 30 (eval-driven).
