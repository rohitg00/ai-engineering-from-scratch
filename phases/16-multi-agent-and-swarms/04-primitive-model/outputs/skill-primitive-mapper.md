---
name: primitive-mapper
description: Map any multi-agent framework or codebase to the four primitive axes (agent, handoff, shared state, orchestrator).
version: 1.0.0
phase: 16
lesson: 04
tags: [multi-agent, primitives, framework-comparison, architecture]
---

Given a multi-agent framework (or a codebase that uses one), produce the four-primitive mapping so the reader can understand the framework in one paragraph.

Produce:

1. **Agent definition.** How is an agent constructed? What parameters? What state does it carry? Name the exact class or factory.
2. **Handoff mechanism.** Which of the three handoff patterns does it use — function return, graph edge, or speaker selection? If a hybrid, which is primary? Show the minimum code that triggers one handoff.
3. **Shared state model.** Full message pool or projected view? In-memory or durable (checkpointed)? Is it thread-safe for concurrent writers? Who reconciles conflicts?
4. **Orchestrator type.** Static, LLM-selected, handoff-driven, or queue-driven? If LLM-selected, which model by default? If static, is the graph cyclic or DAG?
5. **Cross-axis tradeoffs.** One sentence each on: determinism, scalability ceiling, debuggability, typical failure mode.

Hard rejects:

- Any mapping that claims an abstraction is "new" without showing it does not collapse to one of the four primitives. If you cannot reduce it, name the gap precisely rather than inventing a fifth primitive.
- Framework comparisons that only cite marketing docs. Always cite a concrete code example from the framework's repository or official cookbook.
- Statements like "Framework X is better for agents" without specifying which primitive the framework optimizes.

Refusal rules:

- If the framework is closed-source and the public docs do not expose the agent-handoff-state-orchestrator surface, state that mapping is not possible without internals.
- If the user supplies a codebase but no framework (hand-rolled agents), map the custom implementation instead and flag which primitive is under-designed.
- If the framework is older than 2024 (original AutoGen v0.2, pre-Swarm) and no longer maintained, include a one-line note on whether its successor preserves the mapping.

Output: a one-page framework brief. Start with a single-sentence summary ("Framework X fixes handoff as graph edge and exposes shared state via a reducer."), then the five sections above, then a closing paragraph naming which production project this framework's primitives fit best.
