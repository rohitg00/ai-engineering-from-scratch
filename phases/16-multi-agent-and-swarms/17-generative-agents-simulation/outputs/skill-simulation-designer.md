---
name: simulation-designer
description: Design a generative-agent simulation (Smallville-style) for a given scenario. Specifies memory schema, reflection cadence, plan horizon, spatial/social constraints, and evaluation metrics.
version: 1.0.0
phase: 16
lesson: 17
tags: [multi-agent, simulation, generative-agents, emergence, memory]
---

Given a scenario that requires emergent behavior from a population of agents (social simulation, game NPCs, policy rehearsal, market dynamics), design the simulation.

Produce:

1. **Population size and heterogeneity.** N agents; which share a base model vs different; prompt families; role distribution. Smallville used 25 homogeneous agents with individualized personas; larger populations benefit from heterogeneity.
2. **Memory schema.** Fields per entry: `(ts, kind, content, importance, embedding_ref, source_ids)`. Recency-decay constant; importance scoring procedure; relevance metric (cosine with embedding model X). Retention policy for compaction.
3. **Reflection cadence.** Trigger: sum of unprocessed importance > threshold, or every N observations, or periodic tick. Number of reflections per trigger. Reflection prompt template.
4. **Plan horizon.** Day / hour / action levels. Which are mandatory; which optional. Revision trigger: a new observation with importance > threshold that contradicts the active plan.
5. **World model.** Spatial grid, social graph, resource constraints. What constitutes an observation (line-of-sight, conversation, notification). What normative constraints the architecture does NOT learn and must be encoded explicitly (capacity limits, closed hours, private spaces).
6. **Seed goals.** Which agents are seeded with which priorities. Overlapping goals that may compete; non-competing goals that should coexist.
7. **Budget.** Per-tick LLM calls per agent (observe + retrieve + reflect + plan + act). Expected tokens per tick per agent. Total simulation cost for T ticks.
8. **Evaluation metric.** Believability (human-rater), goal achievement rate, coordination events counted, spatial-norm violations as a failure signal.

Hard rejects:

- Designs without explicit spatial / social norm encoding. The architecture will violate them (closed-store, single-bathroom failures from Park 2023).
- Designs with mutable memory. Memory must be append-only; corrections are new entries.
- Designs that run reflection every tick. This is budget-inefficient; reflection is expensive and triggers should be threshold-based.
- Simulations at large N (> 50) without a memory-compaction strategy. Retrieval cost grows with stream length.

Refusal rules:

- If the scenario requires emergent *task execution* rather than emergent *social behavior*, recommend the supervisor / roles / primitives patterns instead (Phase 16 · 05-08). Smallville is for social simulation.
- If budget allows < 100 LLM calls per tick total, recommend N = 3-5 with dense interactions rather than larger populations.
- If the scenario does not benefit from emergence (tightly-scripted task), recommend single-agent + tools.

Output: a one-page design brief. Start with a single-sentence summary ("Smallville-style simulation: 15 heterogeneous agents, reflection at importance sum > 120, 3-level plan horizon, spatial grid with capacity constraints, measured by believability + coordination events."), then the eight sections above. End with the expected emergent behaviors and the first three failure modes to watch for.
