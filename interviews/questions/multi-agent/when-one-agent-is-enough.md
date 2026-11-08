---
id: when-one-agent-is-enough
title: Five agents for a task that one call handles
card: multi-agent
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, system-design]
tags: [single-agent, complexity-cost, lossy-boundary, coordination, latency]
minutes: 8
lessons: [phases/16-multi-agent-and-swarms/01-why-multi-agent]
manuals: []
practice: []
cheatsheet: [multi-agent]
related: [multi-agent/the-single-agent-ceiling]
updated: 2026-11-03
---

A team proposes a five-agent pipeline, with a planner, a retriever, a writer, a critic and a formatter, for a summarization feature that one agent handles today in a dozen tool calls. The argument is that specialists produce better output. How do you decide, and what will the pipeline cost that the slide does not show?

## Short answer

Keep the single agent unless the task fails one of three tests: it needs more context than one window holds, it needs different prompts at different stages, or it has work that can run at the same time. A dozen tool calls on a task that fits in one window passes none of them. The pipeline adds a lossy compression step at each of four boundaries, coordination logic that has its own bugs, at least five serial model calls of latency, and five times the token cost.

## Full answer

### The three tests

| Test | What it asks | This task |
|---|---|---|
| Context | Does the working data exceed one window, roughly 100k tokens? | No, a dozen tool calls fit |
| Expertise | Do stages need different system prompts? | A summarizer and a formatter can share one prompt |
| Parallelism | Can parts of the work run at the same time? | The stages are serial |

The lesson's rule of thumb is that a task under 20 tool calls and 100k tokens stays with one agent.

### The hidden costs

- **Lossy boundaries.** Every message between agents compresses the sender's full context into a message. Four boundaries are four places where the detail the critic needed is gone.
- **Coordination bugs.** Who runs when, in which order, with which input is new code, and it fails in new ways.
- **Latency.** Five agents are at least five serial model calls, more if the critic sends work back to the writer.
- **Cost.** Each agent spends its own tokens, so the bill multiplies.
- **Debugging.** One conversation becomes five, and a wrong answer has to be traced across the messages between them.

### When the slide would be right

If the feature grows to summarize documents that do not fit in one window, split by document and merge. If the critic needs a prompt that argues against the writer, that is a real second role. If three sources can be read at once, fan out. Each of those is one of the three tests, and the split should match the test it passes, not add every role at once.

### How to settle it

Run both on the same task set and measure quality, latency and tokens. The lesson's comparison shows the multi-agent version using more total tokens while each stage's context stays clean. If the quality gain does not pay for the latency and the cost, the single agent wins.

## Follow-ups

- **Level 2:** The critic sends the draft back to the writer. What does that do to the latency? Expected: each round adds two more serial model calls, so the loop must have a cap on rounds.
- **Level 2:** Which single split would you accept first, if any? Expected: a critic with an adversarial prompt, because it is the one role that needs a different system prompt, and only if the eval shows a gain.
- **Level 3:** Why is the boundary between agents described as lossy compression? Expected: the receiving agent sees only the message, not the sender's tool results and reasoning, so any detail that was not written into the message is gone.
- **Level 3:** How does the choice change if the summaries must be produced under a strict latency target? Expected: serial stages are the enemy of latency, so stay single or fan out only the parts that run in parallel.

## Wrong answers

- "Specialists always beat a generalist." Specialists win when the task fails one of the three tests, and this task fails none.
- "More agents means more checks, so quality goes up." Each boundary loses information, and a critic that never sees the sources cannot check them.
- "Token cost does not matter at our scale." Five agents multiply the bill and the latency on every request, and that is a product decision, not a detail.

## Taught in

The [why multi-agent lesson](../../../phases/16-multi-agent-and-swarms/01-why-multi-agent/) gives the three tests, the complexity cost and the rule of thumb.
