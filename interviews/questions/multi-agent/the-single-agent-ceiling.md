---
id: the-single-agent-ceiling
title: Where one agent stops working, and why
card: multi-agent
kind: concept
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [single-agent-ceiling, context-saturation, role-confusion, parallelism]
minutes: 6
lessons: [phases/16-multi-agent-and-swarms/01-why-multi-agent]
manuals: []
practice: []
cheatsheet: [multi-agent]
related: []
updated: 2026-11-03
---

Your single agent does well on small tasks. Pointed at a codebase of 200 files in three languages, with tests that need infrastructure and an external API to research first, it stops making progress. The team proposes a model with a bigger window. What is the ceiling it hit, and would a bigger window remove it?

## Short answer

The task exceeds what one loop, one window and one system prompt can carry, and a bigger window only moves one of three limits. Context saturates as tool results pile up, so details from an early turn are gone by turn 30, and one prompt that asks the model to research, code, review and test produces an agent that does each one poorly. One loop reads file A, then B, then C, with no parallelism. The fix for all three is to split the work so that each agent has one job, one window and one prompt.

## Full answer

### Three things break

1. **Context saturation.** Tool results accumulate. By turn 30 the agent has consumed about 150k tokens of file contents, command output and its own reasoning, and the detail from turn 5 is lost. Reading 50 large files can pass a 200k window.
2. **Role confusion.** A system prompt that says you are a researcher, a coder, a reviewer and a tester produces an agent that half-researches, half-codes and never finishes the review.
3. **Sequential bottleneck.** The agent reads three files in three serial model calls and three serial tool executions. Nothing runs at the same time.

### What a bigger window changes

It delays the first limit and does nothing for the other two. The agent still forgets what it read 40 tool calls ago, because the problem is attention over a long history, not the hard limit. The prompt still asks one model to be four roles. The loop is still serial.

### The split

Give each agent one job, one window and one prompt tuned for that job. The researcher reads documents and outputs only the facts needed for implementation. The coder receives those facts and writes code. The reviewer receives the code and finds bugs. The researcher's reading never enters the reviewer's window, because each agent receives only the messages addressed to it.

### When to stay single

The lesson's rule of thumb: a task that takes fewer than 20 tool calls and fits in 100k tokens stays with one agent. Splitting costs more total tokens, adds coordination logic that has its own bugs, and turns debugging from reading one conversation into tracing messages across several.

## Follow-ups

- **Level 1:** Which of the three limits does parallelism address? Expected: the sequential bottleneck only, because reading three files at once does not shrink any one window or sharpen any one prompt.
- **Level 2:** Why does a specialized prompt improve each stage? Expected: a prompt that covers one role can be specific about inputs, outputs and what to ignore, while a prompt for four roles has to be generic.
- **Level 2:** What is the cost that the split always adds? Expected: more total tokens, because each agent is a separate model call, plus latency and coordination logic.
- **Level 3:** Where does information get lost in a multi-agent split? Expected: at every agent boundary, where one agent's full context is compressed into a message for the next.

## Wrong answers

- "A bigger context window solves it." The window moves one limit and leaves role confusion and the serial loop untouched.
- "A longer, more detailed system prompt covers the roles." A single prompt that covers four roles is the cause of role confusion, not the cure.
- "Always split, because specialists are better." Below about 20 tool calls and 100k tokens, the split adds cost and bugs for no gain.

## Taught in

The [why multi-agent lesson](../../../phases/16-multi-agent-and-swarms/01-why-multi-agent/) names the three limits and the rule of thumb for staying single.
