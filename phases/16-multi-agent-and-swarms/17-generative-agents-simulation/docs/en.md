# Generative Agents and Emergent Simulation

> Park et al. 2023 (UIST '23, arXiv:2304.03442) populated **Smallville**, a sandbox of 25 agents, with a three-part architecture: **memory stream** (natural-language log), **reflection** (higher-level syntheses the agent generates about its own stream), and **plan** (day-level behavior, then sub-plans). The landmark result was the Valentine's Day party emergence: one agent seeded with "wants to throw a Valentine's Day party," without further scripting, produced invitations spread through the population, coordinated dates, and the party happened — from 24 agents who started with no knowledge of it. Ablations show all three components are required for believability. The documented failures are spatial-norm errors (entering closed stores, sharing single-person bathrooms). This is the reference architecture for agent simulations and multi-agent social evaluation in 2026.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problem

Most multi-agent systems are tightly-scripted teams: planner plans, coder codes, reviewer reviews. That works for well-defined tasks. It does not capture the emergent, unscripted behavior that arises when agents have memory, priorities, and an open world. Research, society simulation, and increasingly game AI need this second kind.

The Smallville architecture is the benchmark for it. Until Park 2023, the best agent simulations were shallow script-followers; after it, the pattern is the default for generative agents in open worlds. If you build an agent simulation in 2026, you are either using Smallville's three components or explicitly justifying why you are not.

## Concept

### The three components

**Memory stream.** An append-only log of observations, actions, reflections, and plans. Each entry has a timestamp, a type, a description (natural language), and derived metadata: **recency**, **importance** (self-rated 1-10 by the agent), and **relevance** (cosine similarity to current query).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

Memory retrieval combines the three scores: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`. Top-k entries enter the current prompt.

**Reflection.** Periodically (every N memories or on important events), the agent generates higher-order syntheses from recent memories. Reflection entries go back into the stream and are retrievable like any other memory. This is how agents build "understandings" — the architecture's equivalent of long-term beliefs.

**Plan.** Top-down decomposition. First, a day-level plan in broad strokes ("go to work, have dinner with Klaus"). Then hour-level plans. Then action-level plans. Plans are revisable: when an observation contradicts a plan, the agent replans the affected segment.

### Why all three matter (ablation)

Park et al. ran ablations dropping each of observation, reflection, and plan. Each ablation hurts believability:

- Without **observation** the agent misses context and acts on stale beliefs.
- Without **reflection** the agent cannot form higher-order beliefs; interactions stay shallow.
- Without **plan** behavior becomes reactive noise; goals dissipate.

Believability scores from human raters are highest with all three; dropping any one produces a measurable regression.

### The Valentine's Day emergence

One agent, Isabella Rodriguez, is seeded with the goal "wants to throw a Valentine's Day party at Hobbs Cafe on Feb 14 at 5pm." The 24 other agents receive no such seed. Over simulated days:

1. Isabella's plan includes inviting people.
2. Each invitation becomes an observation in a neighbor's memory stream.
3. That neighbor's reflection generates beliefs: "Isabella is throwing a party."
4. The neighbor's plan incorporates "attend party on Feb 14."
5. Neighbors tell other neighbors. The invitation spreads without central coordination.
6. At 5pm on Feb 14, several agents converge at Hobbs Cafe.

This is emergence in the technical sense: system-level behavior (a party) arose from local interactions (bilateral invitations + individual planning) without a central orchestrator.

### The documented failure modes

Park et al. explicitly document:

- **Spatial norm errors.** Agents walk into closed stores. Agents try to use the same single-person bathroom. Agents eat in rooms not intended for eating. The model does not infer social-physical norms from the environment alone.
- **Memory overflow.** Deep simulation runs cause memory-retrieval cost to grow. Practical remedy: periodic memory compaction (summarize-and-prune) and decay on low-importance entries.
- **Reflection hallucination.** Reflections can invent relationships that do not exist in the memory stream. Mitigation: include source memory ids in reflection prompts and verify at retrieval time.

These are production-relevant failure modes: any 2026 agent simulation inherits them.

### Three-component implementation rules

1. **Memory is append-only.** Never mutate a memory entry. Corrections are new entries.
2. **Importance scores are cheap.** Call the LLM to rate importance 1-10 at write time. Cache the score.
3. **Retrieval is ranked, not filtered.** Top-k by combined score; do not use hard filters (which lose context).
4. **Reflection runs periodically.** Trigger when the sum of importance of unprocessed memories exceeds a threshold (e.g., 150).
5. **Plans are revisable.** When a new observation contradicts a plan, regenerate the affected segment only, not the whole plan.

### Generative agents beyond Smallville

The 2024-2026 follow-up literature extends the architecture:

- **Multi-agent social simulation for policy / market research.** Smallville-like populations simulate user behavior in response to features. Faster than A/B tests; accuracy is contested.
- **NPC AI for games.** RPGs with Smallville agents produce emergent storylines instead of scripted quests.
- **Generative-agent evaluation benchmarks.** Rather than task accuracy, the metric becomes believability + coherence of behavior over long runs.

The architecture is the reference. Extensions swap components (vector store for memory, retrieval-augmented reflection, neurosymbolic plan) but keep the three-part structure.

### Why this matters for multi-agent engineering

Smallville is the proof of concept that multi-agent emergence is cheap when the components are right. The architecture has now been replicated on open-source models (smaller LLMs lose believability gracefully, not sharply). Any production system that needs **emergent social behavior** uses this shape. Any system that needs **tight task execution** uses the supervisor / roles / primitives patterns from earlier in this phase.

## Build It

`code/main.py` implements the three components in stdlib Python with scripted agent policies (no real LLM). The demo reproduces the Valentine's-party emergence in miniature:

- `MemoryStream` — append-only log with recency/importance/relevance retrieval.
- `reflect(stream)` — scripted reflection over recent high-importance memories.
- `plan(agent_state)` — day-level and hour-level plans based on current beliefs.
- Scenario: 5 agents. Agent 1 starts with "throw party at 5pm." Over simulated ticks, the invitation spreads and agents converge.

Run:

```
python3 code/main.py
```

Expected output: tick-by-tick trace. By the final tick, at least 3 of the 5 agents show the party in their plan, and they converge at the party location. The single seed produced the coordinated arrival without any orchestrator.

## Use It

`outputs/skill-simulation-designer.md` designs a generative-agent simulation: number of agents, memory schema, reflection cadence, plan horizon, and evaluation metric.

## Ship It

Rules for production simulations:

- **Memory is the database.** Pick a real store (vector DB, Postgres) at scale. In-memory stdlib is for prototypes.
- **Log the retrieval trace.** For every action, log the top-k memories that drove it. This is your debug ability.
- **Budget per-agent tokens.** Each agent's retrieve + reflect + plan per tick is O(k) LLM calls. N agents × T ticks × calls-per-tick can dwarf your budget.
- **Compact memory periodically.** Summarize-and-prune low-importance entries. Retention policy is a design decision, not a detail.
- **Detect spatial / social norm violations** explicitly. The architecture does not learn them.

## Exercises

1. Run `code/main.py`. Confirm 3+ agents converge at the party. Increase agents to 10 — does the emergence still happen?
2. Remove the reflection step. What does behavior look like? Map to the ablation finding in Park 2023.
3. Introduce a competing seeded goal ("Klaus wants to give a research talk at 5pm"). Do agents split, or does one goal dominate? What determines it?
4. Add spatial constraints: Hobbs Cafe holds at most 4 agents. Does the simulation handle overflow gracefully, or does it hit the "single-person bathroom" failure pattern?
5. Read Park et al. (arXiv:2304.03442) Section 6 (emergent behavior experiments). Identify one behavior not reproducible in your miniature. What component of the architecture would you need to enhance?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Further Reading

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — the reference architecture
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) — publication venue
- [Smallville code release](https://github.com/joonspk-research/generative_agents) — reference Python implementation
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — prior art for structured-memory agents
