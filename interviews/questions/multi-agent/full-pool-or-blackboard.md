---
id: full-pool-or-blackboard
title: Every agent reads everything, or agents subscribe to topics
card: multi-agent
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [design-review, system-design]
tags: [message-pool, blackboard, subscription, projection, write-contention]
minutes: 10
lessons: [phases/16-multi-agent-and-swarms/13-shared-memory-blackboard]
manuals: []
practice: []
cheatsheet: [multi-agent]
related: [multi-agent/a-number-that-never-existed, multi-agent/four-primitives-for-any-framework]
updated: 2026-11-03
---

A team of four agents shares one message log, and every agent reads all of it. The team is about to grow to a few dozen agents, and the context each agent carries is already large. Compare keeping the single log with moving to topics that agents subscribe to, and say how you would handle several agents writing at once.

## Short answer

A full pool is simple, transparent and easy to inspect, and it stops scaling at about 10 agents because each agent's window fills with the others' work. A blackboard with subscriptions routes only the relevant messages to each agent, so it scales further, and it costs an up-front schema that makes the topics meaningful. Many systems mix the two: a small pool at the planning layer and blackboards below it. For writes, most systems serialize through one writer, because model calls are slow enough that contention is rare.

## Full answer

### The two topologies

| Topology | Who reads what | Wins when | Costs |
|---|---|---|---|
| Full message pool | Every agent reads every message | Few agents, mixed roles, short horizon | Context grows with every turn, and poisoning spreads to everyone |
| Blackboard with subscriptions | Agents declare topics and receive only those | Many agents, similar roles, long-running | A schema must exist before the topics mean anything |

The pool wins when reasoning about who said what is cheap because everyone saw everything. The blackboard wins when routing saves tokens and keeps unrelated work out of each window.

### Projection goes one step further

A blackboard gives every subscriber of a topic the same view. A per-agent projection gives each role a view computed from the global state, which is what state reducers do in graph runtimes. It scales furthest and needs a schema, and without one each agent rebuilds its own projection in its prompt.

### Writes

Concurrent writes from many agents are a concurrency problem, not a model problem. Three patterns work:

1. **A single writer.** All writes go through one coordinator that serializes them. Simple, and a bottleneck.
2. **Optimistic concurrency with versions.** Each entry carries a version, and a write fails and retries on a mismatch.
3. **Topic partitioning.** Each agent owns topics, so there is no cross-topic contention, and the partition boundaries must be designed.

Most frameworks default to the single writer, because model calls are slow enough that the bottleneck does not hurt.

### What does not change

Both topologies are shared state, the only stateful part of the system, and both need provenance on every entry, an append-only log and a read-only verifier. Topic partitioning limits who reads a poisoned entry. It does not stop the poisoning.

### The pattern has a history

The blackboard predates model agents by four decades. Specialist knowledge sources watch a shared board, contribute partial solutions and trigger each other. The current systems are the same pattern with model agents as the knowledge sources and structured entries as the partial solutions, and the old literature already documents write contention and consistency.

## Follow-ups

- **Level 2:** A planning layer of three agents and a worker layer of thirty. Which topology where? Expected: a full pool for the three planners, who need to see each other, and blackboards for the workers, who need only their topics.
- **Level 2:** Which poisoning scenarios does topic partitioning make harder? Expected: a poisoned entry reaches only the subscribers of its topic, so cross-topic spread is cut, while subscribers of that topic are poisoned the same way.
- **Level 3:** When would you move from a single writer to optimistic versioning? Expected: when writes are frequent enough that the coordinator's queue adds visible latency, which is rare while each write follows a slow model call.
- **Level 3:** What goes wrong when you add a blackboard without a schema? Expected: topics are named ad hoc, agents subscribe to the wrong ones or to everything, and you rebuild the full pool with more code.

## Wrong answers

- "Keep the pool and give agents bigger windows." The pool grows with every turn from every agent, and a bigger window delays the limit without removing it.
- "Pass messages directly between agents instead of sharing state." Direct messages are shared state with extra copying, and they lose the inspectable log.
- "Partition by topic and the poisoning problem is solved." Partitions limit the spread, and an entry with no provenance and no verifier still poisons every subscriber of its topic.

## Taught in

The [shared memory lesson](../../../phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) builds both topologies and the write-contention patterns.
