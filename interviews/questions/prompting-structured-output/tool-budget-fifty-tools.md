---
id: tool-budget-fifty-tools
title: What fifty tool definitions cost on every call
card: prompting-structured-output
kind: estimate
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, screen]
tags: [context-engineering, tool-pruning, token-budget, estimate]
minutes: 9
lessons: [phases/11-llm-engineering/05-context-engineering]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/lost-in-the-middle-order, prompting-structured-output/tool-description-is-a-prompt]
updated: 2026-11-03
---

A coding assistant exposes 50 tools, each defined with a name, a description and a parameter schema. Estimate what the tool definitions cost on every call, and say how you would cut that cost without removing a single tool from the product.

## Short answer

Each definition costs 50 to 200 tokens, so 50 tools at 150 tokens each is 7,500 tokens before the conversation begins, repeated on every call. Classify the intent of the query and include only the tools that match it; the lesson puts the reduction at 60 to 80 percent, from about 8,000 tokens down to about 1,000. The product keeps every tool; only the per-call definition list changes.

## Full answer

### The count in context

The lesson's breakdown for a coding assistant: system prompt 500 tokens, tool definitions for 50 tools 8,000, retrieved documentation 4,000, history for ten turns 6,000, the query 200, and a generation budget of 4,000, for a total of 22,700 tokens. The tool block is the largest item, and unlike the history it does not depend on how long the conversation has been.

### Why it repeats

Definitions live in the context, so a 50-turn conversation pays the full block 50 times. Every token of it also displaces a token that could carry signal, which is the context engineering point: the window is a scarce resource, not a dump.

### Pruning without removing

1. Classify the intent of the query. The lesson does it with keyword lists per intent: code, calendar, email, research, data.
2. Tag each tool with the categories it serves.
3. Include tools whose categories match the intents, in order, until a token budget is reached; the lesson's selector stops at 2,000 tokens.
4. A code question never sees the calendar tools, and a scheduling question never sees the file system tools.

### Check the cost of being wrong

Pruning risks leaving out a tool that the classifier did not predict. The lesson's exercise measures task success with 5, 10, 20 and 50 tools included and compares the curves; a priority score per tool, filled in descending order until the budget is spent, is the refinement over a binary include or exclude.

## Follow-ups

- **Level 3:** Why does the cost repeat? Expected: definitions sit in the context on every call, so a 50-turn conversation pays the full block 50 times.
- **Level 3:** How does the lesson choose which tools to send? Expected: keyword intent classification over the query, then the tools whose categories match, added until a 2,000 token budget is reached.
- **Level 4:** What does pruning risk, and how do you check it? Expected: a needed tool left out for a misread query; measure task success with 5, 10, 20 and 50 tools included and watch the misses per intent.
- **Level 4:** How do the 7,500 tokens compare with the rest of the lesson's breakdown? Expected: the breakdown totals 22,700 tokens, and the tool block at about 8,000 is the largest item, ahead of history at 6,000 and retrieved text at 4,000.

## Wrong answers

- "Tokens are cheap, send all 50." It is the largest block in the lesson's breakdown and it repeats on every call; it also displaces context that carries signal.
- "Shorten every description to one word." Then the model cannot tell the tools apart; prune by relevance and keep each description precise.
- "Remove the rarely used tools from the product." The product need not change; the per-call definition list does.

## Taught in

The lesson [context engineering](../../../phases/11-llm-engineering/05-context-engineering/) gives the token breakdown, the tool pruning numbers and the dynamic tool selector.
