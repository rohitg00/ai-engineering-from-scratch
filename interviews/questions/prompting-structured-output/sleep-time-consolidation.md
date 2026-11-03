---
id: sleep-time-consolidation
title: Move memory consolidation off the critical path
card: prompting-structured-output
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [agent-memory, memory-blocks, sleep-time, latency]
minutes: 10
lessons: [phases/14-agent-engineering/08-memory-blocks-sleep-time-compute, phases/14-agent-engineering/07-memory-virtual-context-memgpt]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/take-home-two-tier-memory, prompting-structured-output/fusion-weights-per-product]
updated: 2026-11-03
---

An assistant's tail latency climbs because every turn also prunes, summarizes and reconciles its memory before it replies. A proposal moves that work to a second agent that runs while the user is idle. What does the split buy, what does it cost, and what new failure does it create?

## Short answer

The split takes the memory work off the critical path, so a reply never waits on consolidation, and the background agent can be a slower and stronger model because nobody is waiting on it. It costs a second agent, a shared block store and the coordination around them. The new failure is silent drift: the background agent rewrites a block and the primary agent never notices, so version the blocks, surface diffs in the trace, and treat the background writer as untrusted when it touches the persona or the safety block.

## Full answer

### What the primary agent keeps

Three tiers. Core memory is always in the prompt and is made of typed blocks, each with an id, a label, a value, a character limit and a description that tells the model when to edit it: a human block, a persona block, and user-defined blocks such as a task or a safety block. Recall is the conversation history. Archival is the external store. The primary agent serves turns and makes raw writes through `block_append`, `block_replace`, `block_read` and `block_summarize`.

### What the background agent does

It reads transcripts and context while the user is idle, writes learned context into shared blocks, deduplicates and summarizes, and invalidates contradicted facts. Three properties follow: no latency cost on the reply, a stronger model becomes affordable, and consolidation gets a natural window when nobody is waiting.

### The three failures and their guards

| Failure | Guard |
|---|---|
| Block bloat: appends hit the character limit | run the summarizer before the write that would pass the cap |
| Silent drift: a block changes and the primary agent never notices | version blocks, record old value and diff on every write, expose a history per block |
| Poisoned consolidation: content an attacker can reach lands in core | treat the background agent as an untrusted writer; a change to the persona or the safety block needs a second-agent review before it commits |

### Keep the heavy work in the sleep pass

Deduplication of records whose text overlaps by more than 90 percent belongs in the background pass and never on the critical path; the lesson's exercise is explicit about that.

## Follow-ups

- **Level 3:** Why can the background agent use a more expensive model? Expected: it is not latency constrained, so a slower and stronger model is affordable.
- **Level 3:** A block keeps growing toward its limit. What runs, and when? Expected: the block summarizer, before the write that would push the block over the cap; the trigger threshold trades summarization calls against overflow.
- **Level 4:** How do you make a background rewrite visible? Expected: version every block, record the old value and a diff on each write, and expose a per-block history so an operator can see why the agent forgot something.
- **Level 4:** The background agent reads attacker-reachable content. What is the control? Expected: treat it as an untrusted writer; a change to the persona or the safety block needs a second-agent review before it commits.

## Wrong answers

- "Run the consolidation at the end of every turn, it is quick." It sits on the critical path and tail latency is the complaint; the point of the split is that the reply never waits.
- "Use the cheapest model for the background agent to save money." It is the one place a stronger model is affordable, and its rewrites shape every later turn.
- "Deduplicate on the critical path too, it is the same code." The lesson runs deduplication only in the sleep pass, never while the user waits.

## Taught in

The lesson [memory blocks](../../../phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/) gives the three tiers, the block pattern, the background agent and its failure modes, and the lesson [virtual context](../../../phases/14-agent-engineering/07-memory-virtual-context-memgpt/) sets the two-tier pattern it extends.
