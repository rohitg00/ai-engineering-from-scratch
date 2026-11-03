---
id: two-cache-layers
title: Two caches, and why one did not move the bill
card: cost-capacity
kind: concept
level: 1
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [screen, ml-breadth]
tags: [prompt-caching, semantic-cache, cost, hit-rate]
minutes: 5
lessons: [phases/17-infrastructure-and-production/14-prompt-semantic-caching, phases/11-llm-engineering/11-caching-cost]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/cache-break-even, cost-capacity/parallel-calls-miss-the-cache]
updated: 2026-11-03
---

A teammate says the service already has caching, because the provider's prompt cache is on. The bill barely moved. Which two kinds of cache exist in a model service, what does each one skip, and why does one of them do nothing for a question that users keep asking?

## Short answer

There are two layers. The provider's prefix cache reuses the attention state of a prompt prefix that an earlier request computed, so the repeated opening tokens get cheaper, but the model still runs. An application-level semantic cache embeds the request and returns a stored answer when a similar question was answered before, so the model call is skipped. The prefix cache cannot serve a repeated question, because the user's part of the prompt still differs token by token and the model still generates the answer.

## Full answer

### The provider prefix cache

The provider stores the keys and values of a cacheable prefix. The next request with the same prefix pays a read price instead of a full prefill. The match is prefix only: the first token that differs ends it, so the stable parts of the prompt go first and the user message goes last. The cache lowers the input cost and the time to first token. Output tokens cost the same as before.

### The semantic cache

Before the call, the application embeds the request and searches for a stored request above a similarity threshold, typically 0.95 or higher. On a hit, it returns the stored answer and no model runs. The hit rate depends on the traffic. The lesson's community numbers put open-ended chat near 10 to 15 percent and structured support near 40 to 70 percent. A simpler exact cache hashes the model, the messages and the temperature, and it serves only deterministic calls.

### Why the bill did not move

The prefix cache discounts input tokens on a repeated prefix. If the prefix is short, if something in it changes on every request, or if output tokens dominate the bill, there is little for it to save. Repeated questions are a different kind of reuse, and only the semantic cache addresses them.

### Stack them

Provider caching handles token-identical reuse. Semantic caching handles meaning-identical reuse. The earlier caching lesson combines both, and puts the combined reduction at 50 to 95 percent on a typical application.

## Follow-ups

- **Level 1:** Which cache returns an answer without running the model? Expected: the semantic cache. The prefix cache still runs the model on the uncached tokens and generates the output.
- **Level 2:** Every user asks a different question under the same system prompt. Which cache helps? Expected: the prefix cache, because the shared prefix is identical and the questions are not.
- **Level 2:** What decides whether a semantic cache is worth adding? Expected: the hit rate on your own traffic, which ranges from about 10 percent on open chat to about 70 percent on structured support, and the cost of a wrong hit.
- **Level 3:** Why does the exact cache refuse to serve a call above temperature zero? Expected: the stored answer was one sample. A call that asks for variation would get a replay instead, which changes the behavior the caller asked for.

## Wrong answers

- "The prefix cache returns the same answer for the same question." It reuses the attention state of the prefix. The model still generates every token.
- "A semantic cache is a prefix cache with fuzzy matching." It sits in your application, keys on embeddings and skips the model. The prefix cache sits at the provider and keys on exact tokens.
- "One cache is enough." They cover different reuse, identical tokens against identical meaning, and the lesson combines them.

## Taught in

The [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) separates the two layers, and the [caching and cost lesson](../../../phases/11-llm-engineering/11-caching-cost/) builds the exact and semantic caches.
