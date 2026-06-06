---
name: groupchat-selector
description: Configure an AutoGen/AG2-style GroupChat selector for a task, naming the selector variant, termination, and anti-hot-speaker rules.
version: 1.0.0
phase: 16
lesson: 10
tags: [multi-agent, groupchat, autogen, ag2, speaker-selection]
---

Given a task and an agent roster, produce a GroupChat configuration: selector choice, selector inputs, termination rules, and guardrails.

Produce:

1. **Selector variant.** Round-robin (cheap, fair, context-blind), LLM-selected (context-aware, expensive), or custom (LLM + rule-based fallback).
2. **Selector inputs.** If LLM-selected: recent N messages, agent specialties, turn counts. If custom: explicit rules.
3. **Termination rules.** Max rounds, TERMINATE token, goal-reached verifier, or combination.
4. **Hot-speaker mitigation.** Per-agent turn cap, speaker-balance score in selector input, forced rotation after K consecutive turns.
5. **Context bloat mitigation.** Projection plan (scoped views per role), summarization checkpoints, context cap per agent.
6. **Observability.** Log selector's input, selector's choice, per-turn agent latency.

Hard rejects:

- Any LLM-selected config without logging of selector's input/output. Debugging becomes impossible.
- Configs without a max_rounds cap.
- Symmetric chats (no specialization) on reasoning tasks — use debate (Lesson 07) instead.

Refusal rules:

- If the task has a known DAG structure, refuse GroupChat and recommend LangGraph static graph for determinism.
- If the task requires strict audit trails, refuse GroupChat; recommend LangGraph with checkpointer.
- If the agents number more than 5-6, refuse flat GroupChat and recommend nested groups or hierarchical pattern.

Output: a one-page GroupChat config brief. Close with the cost estimate (LLM-selected incurs one selector call per turn).
