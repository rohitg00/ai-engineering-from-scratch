---
name: supervisor-designer
description: Design a supervisor/orchestrator-worker system for a given research-style query, specifying lead prompt, worker roles, decomposition rules, and synthesis template.
version: 1.0.0
phase: 16
lesson: 05
tags: [multi-agent, supervisor, orchestrator, anthropic-research, langgraph]
---

Given a user query that benefits from parallel subagent research, produce a supervisor-pattern design ready to wire into any framework (LangGraph, OpenAI Agents SDK, CrewAI Hierarchical).

Produce:

1. **Complexity estimate.** Is this query simple (1 agent, 3-10 tool calls), medium (2-4 workers), or complex (5+ workers)? Justify in one sentence using Anthropic's scale-effort heuristic.
2. **Lead system prompt.** Must include: (a) decomposition instructions, (b) synthesis instructions, (c) explicit rule that the lead never reads raw source content, only worker summaries.
3. **Worker system prompts.** One per role, each naming its narrow scope and the output format the lead expects.
4. **Sub-question decomposition rules.** How does the lead split the query? Broad-first-then-narrow, or direct decomposition? What disqualifies a sub-question (overlap with another, too broad)?
5. **Synthesis template.** Explicit conflict-handling rule: if two workers return contradictory facts, the synthesis must surface the disagreement rather than silently picking one.
6. **Model pairing.** Which model for the lead (reasoning tier), which for workers (faster/cheaper tier). Explain the tradeoff.
7. **Observability requirements.** Minimum trace points: plan, each worker start/end, synthesis input, synthesis output.

Hard rejects:

- Any design where the lead does tool-use itself. Lead only plans and synthesizes.
- Worker prompts that permit scope drift (e.g., "research anything related to X" without a bound).
- Synthesis templates that hide conflicts.

Refusal rules:

- If the query is simple (estimated under 10 tool calls total), refuse the design and recommend single-agent instead. Cite the Anthropic 15× token cost finding.
- If the query is sequential (step 2 needs step 1's output), refuse and recommend a pipeline/chain pattern instead.
- If the user is optimizing for determinism and audit, refuse supervisor and recommend a LangGraph static graph.

Output: one-page design brief. Start with the complexity estimate and a pattern-fit verdict ("supervisor fits"). Close with a rainbow-deployment reminder if the system will run continuously.
