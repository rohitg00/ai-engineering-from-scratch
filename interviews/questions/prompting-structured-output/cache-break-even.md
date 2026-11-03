---
id: cache-break-even
title: Pick the cache lifetime for a batch of code reviews
card: prompting-structured-output
kind: estimate
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [system-design, screen]
tags: [prompt-caching, cost, ttl, break-even]
minutes: 10
lessons: [phases/11-llm-engineering/15-prompt-caching]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [prompting-structured-output/timestamp-kills-the-cache]
updated: 2026-11-03
---

Your batch job sends the same 15,000-token rubric with each of twenty code reviews, spread over 40 minutes. The provider charges a 25 percent write premium for a five-minute cache and double that for a one-hour cache, and bills reads at one tenth of the input rate. Which cache do you pick, and show the break-even.

## Short answer

The five-minute cache pays for itself on the first read: a write costs 1.25 times and a read 0.1 times the normal input rate, so one write plus one read averages 0.675 times, a saving of 32 percent, and one write plus ten reads averages 0.205 times, a saving of 80 percent. Over 40 minutes the five-minute cache expires between reviews unless they arrive inside the window, so the one-hour cache fits; its write costs 2 times the premium and it needs only two reads to come out ahead, and twenty reviews give far more. The rule of thumb is to cache anything reused at least three times within the lifetime.

## Full answer

### The arithmetic

| Case | Cost per request against uncached |
|---|---|
| One write, five-minute cache | 1.25 |
| One read | 0.1 |
| One write plus one read, averaged | 0.675, a saving of 32 percent |
| One write plus ten reads, averaged | 0.205, a saving of 80 percent |
| One write, one-hour cache | 2 times the premium, so two reads to break even |

### The lifetime decides it

If the reviews arrive steadily over 40 minutes, the gaps between some of them exceed five minutes, and each expiry costs a new write at the premium. The one-hour cache holds the whole batch for one write. If instead they come as a burst of a few inside one minute followed by an idle hour, each burst fits the five-minute cache and the cheaper write wins. Pick from the arrival pattern, not from the total count.

### Prove it on the response

Read the usage fields: the lesson's first request reports 15,023 tokens written at 1.25 times, and the second reports the same count read at 0.1 times with zero written. In production, gate the deploy on a read fraction above 80 percent after warmup, and split the cost dashboard into cached and uncached tokens.

### Other provider shapes

The automatic provider gives 50 percent off reads with no premium, up to an hour on a best-effort basis, so the only job is a stable prefix. The explicit cache object on the third provider is storage-billed and reads at about 25 percent of the input rate; it fits reuse of one giant prompt across days.

## Follow-ups

- **Level 3:** Why does the five-minute cache break even on the first read? Expected: the write costs 1.25 times and the read 0.1 times, so two requests average 0.675 times the uncached cost.
- **Level 3:** What does the one-hour cache need to come out ahead? Expected: two reads, because its write costs 2 times the premium.
- **Level 4:** The reviews arrive in bursts of several within a minute, then nothing for an hour. Does the answer change? Expected: yes; each burst lives inside a five-minute cache, so the cheaper write wins, and the one-hour cache would pay the double premium for reuse that never comes.
- **Level 4:** How do you verify the saving in production rather than on paper? Expected: read the cache creation and cache read token fields on each response, gate the deploy on a read fraction above 80 percent after warmup, and split the dashboard into cached and uncached tokens.

## Wrong answers

- "Always pick the longer cache to be safe." It doubles the write premium; with reuse inside five minutes the shorter cache is cheaper.
- "The write premium makes caching a loss for short jobs." One write plus one read already saves 32 percent on the five-minute cache.
- "Cache the user message too." It differs on every request, so it never hits; the layout leaves it below the breakpoint.

## Taught in

The [prompt caching lesson](../../../phases/11-llm-engineering/15-prompt-caching/) gives the provider table, the break-even arithmetic and the usage fields.
