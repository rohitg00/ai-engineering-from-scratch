---
id: four-primitives-for-any-framework
title: Read any multi-agent framework in one paragraph
card: multi-agent
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [primitives, handoff, shared-state, orchestrator, frameworks]
minutes: 6
lessons: [phases/16-multi-agent-and-swarms/04-primitive-model]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-frameworks-compared]
related: [multi-agent/the-single-agent-ceiling]
updated: 2026-11-03
---

A new multi-agent framework ships every few months, each with its own vocabulary. Give the method you use to understand a new one quickly, and name the part of every such system where the hard bugs live.

## Short answer

Map the framework onto four primitives: the agent, the handoff, the shared state and the orchestrator. Every framework picks a default on each axis, and the rest is surface syntax. The agent is a system prompt plus tools and is stateless, the handoff is a structured transfer of control, the orchestrator decides who runs next, and the shared state is the only stateful part of the system. That is where the difficult bugs sit: memory poisoning, message ordering, versioning and write contention.

## Full answer

### The four axes

| Primitive | Definition | Common implementations |
|---|---|---|
| Agent | A system prompt, a tool list and a model, with no memory of its own | Interchangeable with any agent that has the same prompt and tools |
| Handoff | A structured transfer of control from one agent to another | A tool that returns the next agent, a graph edge with a condition, or a speaker-selection function |
| Shared state | Any data that more than one agent reads, and sometimes writes | A full message pool, a topic-keyed blackboard, a typed state with reducers, external memory |
| Orchestrator | Whoever decides who speaks next | A static graph, a model that picks the speaker, the current agent's handoff call, or a scheduler over a queue |

### Three questions answer most of it

1. Does the orchestrator trust the model to route, or does code pin the route?
2. Is the shared state the full history, or a projected view per role?
3. Can agents change each other's prompts, or only hand off?

The lesson claims these three answer about 80 percent of which framework fits a problem. You stop shopping for the best framework and start designing for the axis you care about.

### The stateless insight

The agent is a function of its prompt and tools. The handoff is a function call. The orchestrator is a scheduler. Only the shared state carries anything from one step to the next, so every interesting bug is a shared-state bug. A framework that hides the state pushes the problem to the caller. A framework that centralizes it makes the state inspectable and moves the coordination cost into the state implementation.

### What is not a primitive

Durable checkpointing, human approval of a handoff, per-agent token budgets and tracing are all built on top of the four. They are design decisions, not new axes. If a framework claims a fifth primitive, check whether it is a flavor of shared state you have not seen.

## Follow-ups

- **Level 1:** Two agents have the same prompt and the same tools. How do they differ? Expected: they do not, because everything that looks like per-agent state is in the shared state or the handoff.
- **Level 2:** Name the three ways a handoff is implemented. Expected: a tool that returns the next agent, a graph edge selected by a condition, and a selector function that picks the next speaker from a pool.
- **Level 2:** Full pool or projected state, which scales further and what does it cost? Expected: projected state scales further, and it costs an up-front schema so that each role's view is defined.
- **Level 3:** Before adopting a framework, what do you write first? Expected: its four-primitive mapping, and if you cannot write it, the docs are incomplete or the framework is inventing a primitive.

## Wrong answers

- "Each framework has its own architecture, so learn them one at a time." The architectures are points in one four-axis space, and learning the axes once reads every release.
- "The agents hold the memory." The agent is stateless by definition, and memory lives in the shared state or in the handoff payload.
- "The orchestrator is the smart part, so pick the framework with the best one." The orchestrator is a scheduler with four flavors, and the choice depends on how much you trust the model to route.

## Taught in

The [primitive model lesson](../../../phases/16-multi-agent-and-swarms/04-primitive-model/) builds the four primitives and maps the current frameworks onto them.
