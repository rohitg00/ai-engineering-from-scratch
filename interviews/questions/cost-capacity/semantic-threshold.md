---
id: semantic-threshold
title: A lower cache threshold hits more and answers wrong
card: cost-capacity
kind: tradeoff
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [system-design, ml-breadth]
tags: [semantic-cache, similarity-threshold, hit-rate, correctness]
minutes: 8
lessons: [phases/17-infrastructure-and-production/14-prompt-semantic-caching, phases/11-llm-engineering/11-caching-cost]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/two-cache-layers, cost-capacity/cache-break-even]
updated: 2026-11-03
---

Your semantic cache serves 20 percent of requests at a similarity threshold of 0.95. A teammate lowered it to 0.85 in staging. The hit rate rose to 50 percent, and a few cached answers did not fit the question asked. Which threshold do you ship, and how do you decide?

## Short answer

Ship the threshold whose wrong hits you can afford, and measure that instead of guessing. A wrong cached answer is a correctness failure that a user sees, while a miss costs one model call. Keep the strict threshold on the general path, and lower it only where the answers are interchangeable or where a disclaimer is acceptable. A vendor's accuracy figure describes how often a hit was appropriate, not how often your traffic hits, so label pairs from your own traffic at both thresholds.

## Full answer

### Two numbers that get confused

The hit rate is the share of requests served from the cache. The accuracy of a hit is whether the stored answer fits the new question. The lesson warns that a vendor's accuracy claim describes match correctness, and that production hit rates are community telemetry that runs from about 10 percent on open chat to about 70 percent on structured support.

### The cost of each error

A miss costs one model call, which you know to the cent. A wrong hit costs a wrong answer in front of a user, a support ticket and some trust, and only the product can price it. The two thresholds trade one for the other.

### Decide with labeled pairs

Sample pairs of a new question and the cached answer it would receive at each threshold. Label each pair as fitting or not. At 0.85 and at 0.95 you then have a hit rate and a precision of hits. Expected saving is the hit rate times the cost of a call. Expected damage is the wrong-hit rate times the cost of a wrong answer. Ship the threshold where the second number is acceptable to the product owner.

### A two-tier scheme

The earlier caching lesson's exercise uses two thresholds: hits at 0.98 return at once, and hits at 0.90 return with a disclaimer that the answer comes from a similar earlier question. Log the tier that served each hit, and compare satisfaction per tier. This keeps the strict path strict and still takes the cheap wins.

### Why some workloads cannot go low

Code questions hit about 20 to 30 percent at best, because a small change in a code question changes the correct answer. Near-duplicate text is not near-duplicate intent there. Voice agents on a fixed prompt set reach 50 to 80 percent, because the questions really repeat.

### The checks around the threshold

Run the exact-match cache first, because a byte-identical repeat needs no embedding. Set a lifetime so that stale answers expire. The embedding cost is small, the lesson quotes a per-million-token price of 0.02 dollars for a small embedding model, so the threshold is the lever, not the embedding bill.

## Follow-ups

- **Level 2:** Why is the accuracy number in a vendor's brochure not your hit rate? Expected: accuracy says how often a returned hit was appropriate. The hit rate says how often there was a hit at all, and it depends on your traffic.
- **Level 2:** What does a miss cost, and what does a wrong hit cost? Expected: a miss costs one model call. A wrong hit costs a wrong answer in front of a user, which the product has to price.
- **Level 3:** How do you lower the threshold without lowering the correctness of the strict path? Expected: a two-tier scheme, with strict matches served as they are and medium matches served with a disclaimer, and the tier logged so that satisfaction can be compared.
- **Level 3:** Why do code questions hit so rarely? Expected: a small variant in a code question changes the correct answer, so similar text is not similar intent.

## Wrong answers

- "Lower the threshold, the savings are bigger." A wrong hit is a correctness failure that a user sees. Its cost is not one model call.
- "Raise the threshold until no hit is ever wrong." The hit rate then approaches the exact-match rate, and the cache stops paying for itself.
- "Use the vendor's accuracy number as the hit rate." The figure describes match correctness, not how often your traffic hits.

## Taught in

The [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) separates match accuracy from hit rate and poses the threshold decision, and the [caching and cost lesson](../../../phases/11-llm-engineering/11-caching-cost/) builds the two-tier thresholds.
