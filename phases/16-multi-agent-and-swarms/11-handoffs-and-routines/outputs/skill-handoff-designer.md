---
name: handoff-designer
description: Design a handoff topology for a Swarm/Agents-SDK-style system: which agents exist, which handoffs they can call, what context transfers.
version: 1.0.0
phase: 16
lesson: 11
tags: [multi-agent, swarm, handoff, openai-agents-sdk]
---

Given a user-facing task (often triage or skill-based routing), produce a handoff topology ready to map onto OpenAI Swarm or the OpenAI Agents SDK.

Produce:

1. **Agent roster.** Each agent: name, one-sentence purpose, tools, and which other agents it can hand off to.
2. **Handoff functions.** The tool signatures per agent. Each handoff function returns a target Agent.
3. **Context transfer policy.** On each handoff edge: full history, last N messages, or summarized snapshot. Justify.
4. **Guardrails.** Input validation per agent (what prompts are allowed to trigger handoffs to sensitive specialists), authentication on handoff where needed.
5. **Loop detection.** Rule to detect ping-pong (e.g., "A handed off to B; B handed off back to A" occurring more than once in a row).
6. **Fallback behavior.** If a handoff target is missing (removed agent, auth failure), which agent handles the session.
7. **Session / memory plan.** Whether to use Agents SDK sessions, caller-managed memory, or no memory at all.

Hard rejects:

- Any handoff design without loop detection.
- Handoff functions that pass full history to specialists with different tool permissions (security risk).
- Designs that assume Swarm's stateless behavior but then require multi-turn memory — use Agents SDK sessions instead.

Refusal rules:

- If the task needs parallel execution, refuse Swarm and recommend supervisor (Lesson 05) instead.
- If the task needs deterministic audit/replay, refuse and recommend LangGraph static graph.
- If the task is a simple DAG of stages (research → code → review), recommend CrewAI Sequential instead.

Output: a one-page handoff brief. Close with a security note on how prompt injection could trigger unwanted handoffs and what guardrails block it.
