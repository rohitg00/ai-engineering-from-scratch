---
id: timestamp-kills-the-cache
title: Cache reads stay at zero on every request
card: prompting-structured-output
kind: debug
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, screen]
tags: [prompt-caching, prefix, cache-control, cost]
minutes: 8
lessons: [phases/11-llm-engineering/15-prompt-caching]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [prompting-structured-output/cache-break-even, prompting-structured-output/lost-in-the-middle-order, inference-serving/prefix-cache-order]
updated: 2026-11-03
---

You enabled prompt caching on a 15,000-token system prompt. The usage field for cache reads stays at zero on every request, while cache creation tokens are charged every time. What do you look for, and in what order?

## Short answer

Something above the cache breakpoint changes on every request. Look first for a timestamp or a request id at the top of the system prompt, then for tool definitions serialized in a changing order, then for near-duplicate text that differs by a byte between code paths, and then for a block under the minimum cacheable size. The cache matches prefixes only, so the first differing token turns everything after it into a miss.

## Full answer

### The invariant

All the providers cache prefixes. When a request's prefix matches a recent one, the provider serves the stored key and value cache instead of encoding the tokens again, and bills a read at a fraction of the input rate. If any token differs, everything after it is a miss. The usage fields tell the story: a creation count every time and a read count of zero means the prefix never matched.

### The checklist, in order

1. **A dynamic field at the top.** A current time, a request id or a session id in the first lines of the system prompt misses on every request. Move it below the breakpoint with the other per-request fields.
2. **Tool reordering.** Tools serialized from a dictionary can change order between deploys or between processes; serialize them in a stable order.
3. **Near-duplicate text.** Two code paths that build the prompt with a one-byte difference produce two prefixes and no hits.
4. **Too-small blocks.** The explicit cache has a floor of 1,024 tokens, 2,048 on the small model; a smaller block silently does not cache.
5. **On the automatic provider**, a changed user field is part of the cache key, and the prefix must still be stable and above 1,024 tokens.

### The layout that hits

System prompt, then tool definitions, then few-shot examples, then retrieved documents if they are reused, then the history up to the last turn, then the current message, which is never cached because it is different every time.

### Turn it into a test

In CI, build two requests through the production prompt builder with the same user input, compare their cacheable prefixes, send both, and assert that the cache read token count is above zero on the second. Two hand-written identical bodies would skip the timestamp or request id that the builder adds. Split the cost dashboard into cached and uncached input tokens, or a traffic drop looks like a cache win.

## Follow-ups

- **Level 2:** How do you make this a test? Expected: two requests built by the production prompt builder with the same user input, with an assertion that the cache read tokens are above zero on the second; if they stay at zero the keys are drifting.
- **Level 2:** Where does the timestamp go instead? Expected: below the breakpoint, with the other per-request fields such as the user message.
- **Level 3:** The block is below the minimum size. What happens? Expected: nothing is cached and nothing is reported; the floor is 1,024 tokens, and 2,048 on the small model.
- **Level 3:** Input tokens fell after your change. Is that proof it works? Expected: no; split the input tokens into cached and uncached, or a drop in traffic looks like a cache win.

## Wrong answers

- "Caching is automatic, there is nothing to configure." On the explicit providers you mark the block; on the automatic one the prefix still has to be stable and above 1,024 tokens, and a changed user field or tool order breaks it.
- "Put the user message first so the model reads it early." That places the only part that changes above everything else, and the cache never hits.
- "Extend the TTL to one hour, the cache is expiring." Expiry would show as writes after quiet periods, not on every request; the one-hour TTL also charges 2x for the write.

## Taught in

The lesson [prompt caching](../../../phases/11-llm-engineering/15-prompt-caching/) gives the prefix invariant, the cache-friendly layout, the pitfalls and the CI check.
