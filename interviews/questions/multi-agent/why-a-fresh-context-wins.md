---
id: why-a-fresh-context-wins
title: Why a lead with workers beats one agent on research
card: multi-agent
kind: concept
level: 1
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [supervisor, fresh-context, token-usage, parallelism, synthesis]
minutes: 6
lessons: [phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern]
manuals: []
practice: []
cheatsheet: [multi-agent, research-agent-pipeline]
related: [multi-agent/the-single-agent-ceiling]
updated: 2026-11-03
---

A research system with one lead agent and several worker agents beat a single agent on an internal evaluation by a wide margin. Explain the mechanism, and say which single variable explains most of the gain.

## Short answer

The lead plans and decomposes the question, each worker gets a fresh window for one narrow sub-question, and the lead synthesizes the worker summaries without ever reading the raw sources. Three mechanisms carry the gain: fresh context per worker, a narrow prompt per role, and workers that run at the same time. The variable that explains most of it is total token usage, which the lesson's source puts at 80 percent of the variance on one browsing benchmark. A worker that does not carry the lead's planning tokens has room to read.

## Full answer

### The shape

The lead receives the question, splits it into sub-questions, and sends one to each worker. Each worker starts from its own system prompt and its sub-question, not from the lead's history. The workers return summaries. The lead never sees the raw material, only the summaries, and writes the answer from them.

### The three mechanisms

1. **Fresh context.** A worker on one sub-question does not carry the tens of thousands of tokens the lead spent planning. It has a full window for its question. The lesson's figure is a 200k window per worker against the 40k the lead already used.
2. **Specialization by prompt.** The lead's prompt says decompose and synthesize. Each worker's prompt says find what changed in one thing. Narrow prompts produce narrow, usable outputs.
3. **Parallelism.** Workers run concurrently, so wall-clock time is about the longest worker plus planning plus synthesis, not the sum of all workers.

### The gain and its price

The lesson reports a gain of 90.2 percent over the single agent on the internal evaluation, and a cost of about 15 times the tokens of a single agent. The same source says that about 80 percent of the variance on one browsing benchmark is explained by token usage alone. The pattern wins because it spends more tokens where they help, not because the lead is clever.

### Operational lessons that come with it

Scale the effort to the question: a simple query needs one agent and a few tool calls, and a complex one may need more than ten workers, and the lead must estimate that. Decompose broad first, then go deeper where an answer warrants it. Long-running stateful agents need a gradual deployment where old versions drain, not a hot swap.

## Follow-ups

- **Level 1:** Why does the lead not read the raw sources? Expected: so that its window stays free for planning and synthesis, and so that each source is read once by the worker who owns it.
- **Level 2:** When does the pattern lose to a pipeline? Expected: when step two needs step one's output, because then there is no parallel work and the extra agents only add tokens.
- **Level 2:** What does the lead do when two workers disagree? Expected: it re-asks or notes the disagreement in the answer, and never picks one side in silence.
- **Level 3:** A worker drifts beyond its sub-question. What stops it? Expected: an explicit scope in its prompt, a timeout at about twice the median worker runtime, and a token cap, after which the lead re-spawns with a narrower question or proceeds without it.

## Wrong answers

- "The lead is a bigger model, so it is smarter." The gain tracks token usage, and the workers do the reading; a bigger lead alone changes nothing about context.
- "Multi-agent is cheaper because workers are small." It costs about 15 times the tokens, and it is worth it only when the task value covers that.
- "Give the lead the raw sources too, so it can check the workers." That fills the lead's window with what the workers already read and removes the fresh-context advantage.

## Taught in

The [supervisor pattern lesson](../../../phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/) builds the lead and the parallel workers and reports the measured gain.
