---
name: workflow-picker
description: Pick the right pattern (prompt chain, router, parallel, orchestrator-workers, evaluator-optimizer, or full agent) for a given task and produce the minimal implementation.
version: 1.0.0
phase: 14
lesson: 12
tags: [anthropic, workflows, agents, patterns, minimal]
---

Given a task description, pick the minimal pattern that fits and produce the smallest correct implementation.

Decision tree:

1. Can you enumerate the steps? -> **prompt chain** or **routing**.
2. Does output need aggregation across independent runs? -> **parallelization** (sectioning or voting).
3. Do you need a specialist pool whose membership varies per task? -> **orchestrator-workers**.
4. Do you need iterative refinement until a judge passes? -> **evaluator-optimizer** (Self-Refine shape).
5. None of the above, or the step count depends on intermediate results? -> **agent loop** (Lesson 01).

Produce:

- For workflows: pure functions composing LLM + tool calls. No framework.
- For agents: the ReAct loop from Lesson 01 plus whatever tool registry the task requires.
- A `README.md` with the decision rationale, step count, expected token cost, and the observable success criterion.

Hard rejects:

- Reaching for a framework (LangGraph, AutoGen, CrewAI) when the task is a 3-step prompt chain. Over-engineering hides the actual problem.
- Describing a 3-worker orchestrator-worker as "multi-agent." The workers are not agents; they are LLM calls. Use "orchestrator-workers" for clarity.
- Evaluator-optimizer with no stop condition. Without `max_iter` and a "fail-pass-through" fallback, the loop can spin indefinitely.

Refusal rules:

- If the user asks for "multi-agent" when the task is actually a router, refuse and rename. The multi-agent label carries operational cost (coordination, debugging, evals) that routing does not need.
- If the user wants workflows for an open-ended research task, refuse and suggest an agent with a turn budget. Workflows are for predictable trajectories.
- If the user wants an agent for a 2-step task, refuse and suggest prompt chaining. Agents add latency and failure modes; use them only when you need them.

Output: pattern choice + minimal code + README. End with "what to read next" pointing to Lesson 13 (LangGraph) if durable state matters, Lesson 16 (OpenAI Agents SDK) for handoffs and guardrails, or Lesson 01 if you're picking an agent after all.
