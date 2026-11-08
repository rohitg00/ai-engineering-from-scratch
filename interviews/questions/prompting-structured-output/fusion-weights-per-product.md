---
id: fusion-weights-per-product
title: Tune a three-store memory for three products
card: prompting-structured-output
kind: design
level: 4
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [agent-memory, hybrid-memory, fusion-scoring, scope]
minutes: 15
lessons: [phases/14-agent-engineering/09-hybrid-memory-mem0, phases/14-agent-engineering/07-memory-virtual-context-memgpt]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/take-home-two-tier-memory, prompting-structured-output/sleep-time-consolidation]
updated: 2026-11-03
---

You own the memory layer for three products on one platform: a consumer chat assistant, a compliance review agent and a research retrieval agent. The memory system runs a vector store, a key-value store and a graph store in parallel and fuses their results. How do you configure the fusion for each product, and which one scoping mistake would get you paged?

## Short answer

The fused score is a weighted sum of relevance, importance and recency, and the weights are tuned per product: recency up for the chat assistant, importance up for the compliance agent, relevance up for the retrieval agent. Each store wins a query class the others miss, so the weights steer which class dominates without dropping a store. The paging mistake is a scope leak: every write picks the user, the session or the agent scope, and a retrieval that mixes scopes without per-scope weights tells one user about another user's project.

## Full answer

### Why three stores

| Query class | Example | Winner |
|---|---|---|
| Semantic similarity | what did we discuss about drift last week | vector |
| Fact lookup | the user's phone number | key-value, keyed on user, fact type and entity |
| Relationship reasoning | which customers share a billing entity | graph, as typed edges |

A single store is wrong for two of the three classes. A write extracts facts from the text and writes each one to all three stores; a search runs all three and fuses.

### The fusion

The score is `w_relevance * relevance + w_importance * importance + w_recency * recency`. Relevance is the cosine, the exact key match or the graph path weight. Importance is tagged at write time or learned. Recency decays with time since the last write or read. It is a weighted sum and not a hierarchy, because a hierarchy would make two of the three classes wait on the wrong store.

| Product | Weight to raise | Why |
|---|---|---|
| Chat assistant | recency | the last few turns matter most |
| Compliance agent | importance | names, ids and policies outrank chatter |
| Retrieval agent | relevance | the question decides, not the clock |

### Temporal truth for compliance

When a new fact contradicts a graph edge, the old edge is marked invalid and never deleted. A question about what was true in March traverses the edges valid at that time. The compliance agent depends on this.

### The scope rule

Each write picks one scope: user memory persists across sessions, session memory lives in one thread, agent memory is per instance. Retrieval can read across scopes with per-scope weights, but a search that mixes them without thought is how an assistant tells one user about another user's project.

### Maintenance that scales with the corpus

- Vector results drift as the corpus grows; re-embed the most used records on a schedule.
- The key-value type set creeps as teams add types; audit it quarterly.
- A noisy extractor adds dozens of edges per message; cap graph writes per add and drop low-confidence edges.

## Follow-ups

- **Level 3:** Which query class does each store win? Expected: vector for semantic similarity, key-value for a fact lookup, graph for relationship reasoning.
- **Level 4:** Why a weighted sum and not vector first with fallbacks? Expected: each store wins a different class; a hierarchy makes two of three classes wait on the wrong store.
- **Level 4:** The compliance agent asks what was true in March. Which store answers, and how? Expected: the graph, by traversing the edges valid at that time; contradicted edges are marked invalid and kept.
- **Level 4:** Which failure grows with the corpus, and what is the maintenance? Expected: embedding drift in the vector store; re-embed the most used records periodically, audit the key-value type set quarterly, and cap graph writes per add.

## Wrong answers

- "One vector store is enough, embeddings capture everything." A fact lookup is wasteful on a vector store and a relationship query is impossible on one.
- "Set the weights once for the platform." Chat wants recency, compliance wants importance, retrieval wants relevance; one setting is wrong for two of the three.
- "Delete the old fact when a new one contradicts it." Mark it invalid and keep it, or the temporal query loses its history.

## Taught in

The lesson [hybrid memory](../../../phases/14-agent-engineering/09-hybrid-memory-mem0/) gives the three stores, the fusion formula, the scope taxonomy and the maintenance list, and the lesson [virtual context](../../../phases/14-agent-engineering/07-memory-virtual-context-memgpt/) places the pattern among the memory types.
