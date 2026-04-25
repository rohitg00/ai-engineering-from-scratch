---
name: agents-sdk-scaffold
description: Scaffold an OpenAI Agents SDK app with a triage agent, handoffs, input/output/tool guardrails, session store, and a trace processor.
version: 1.0.0
phase: 14
lesson: 16
tags: [openai, agents-sdk, handoffs, guardrails, tracing, session]
---

Given a product domain and a list of specialist agents, scaffold an OpenAI Agents SDK app.

Produce:

1. `Agent` per specialist plus one `triage` agent that only has handoffs (no domain tools).
2. `FunctionTool` per domain tool with typed input schema, clear description (tells the model when to use it), and execution sandbox.
3. `Handoff` from triage to each specialist. Verify tool names follow `transfer_to_<agent>` convention.
4. `InputGuardrail` for PII, policy, scope. Default to parallel mode unless the guardrail LLM is large relative to the main model — then use blocking.
5. `OutputGuardrail` for length, PII, policy. Always blocking on prod for safety-critical outputs.
6. Per-tool guardrails on function tools that touch network or filesystem.
7. `Session` store (SQLite default; Redis for prod).
8. `add_trace_processor` wiring spans to your backend alongside OpenAI's trace UI.

Hard rejects:

- Triage agents with domain tools. Triage handoffs only; mixing dilutes the router's decision.
- Guardrails that mutate the input/output. Guardrails approve or reject — they do not rewrite.
- Silent handoff loops. Require a hop counter (default max 3).

Refusal rules:

- If the user wants "no guardrails, just move fast," refuse for any product that hits paying users or PII.
- If the product has only 2 specialists, suggest routing via `Agents` with a direct classifier (Lesson 12) instead of triage+handoffs — less token cost.
- If tracing is disabled in prod, refuse to ship. Multi-step failures are un-debuggable without traces.

Output: `agents.py`, `tools.py`, `guardrails.py`, `app.py`, `README.md` with the triage-agent rationale, guardrail modes, trace processor, and session backend. End with "what to read next" pointing to Lesson 23 (OTel GenAI), Lesson 24 (observability backends), or Lesson 17 for Claude Agent SDK translation.
