---
id: temperature-and-acceptance
title: Speculation flies on code and stalls on creative writing
card: tokenization-decoding
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, screen]
tags: [speculative-decoding, temperature, sampling, acceptance-rate, greedy]
minutes: 8
lessons: [phases/07-transformers-deep-dive/16-speculative-decoding, phases/10-llms-from-scratch/25-speculative-decoding, phases/10-llms-from-scratch/15-speculative-decoding-eagle3, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding]
manuals: []
practice: [lab-sampling-temperature]
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/speedup-from-alpha]
updated: 2026-11-03
---

Your creative-writing product samples at a high temperature and speculative decoding gives it no speedup at all, while the same setup flies on code completion. Explain the difference, and describe what the acceptance test becomes at temperature zero.

## Short answer

Acceptance depends on how often the verifier agrees with what the draft sampled. At a high temperature the target distribution is flat, the draft's samples spread across many tokens, and the acceptance ratio of verifier to draft probability falls toward one over the vocabulary size, so almost every draft is rejected and the draft's cost is paid for nothing. Code and structured output are predictable, so acceptance climbs above 0.9. At temperature zero the rule becomes a comparison: accept if the drafted token equals the verifier's most likely token, otherwise emit that token and stop.

## Full answer

### Why temperature is the lever

The acceptance test is `u < min(1, q(d) / p(d))`. When both distributions are peaked on the same token the ratio is near one and the draft is accepted. Raise the temperature and both distributions flatten: the draft now samples tokens that the verifier gives little probability, the ratios shrink, and the rejections pile up. The lesson's exercise runs the loop at a temperature of 1.5 to show the collapse, where the algorithm becomes slower than plain decoding because the draft overhead stays and the accepted tokens vanish.

### Why the task matters

| Workload | Measured speedup in the lesson |
|---|---|
| chat | 2 to 3 times |
| code generation | 3 to 5 times |
| creative writing | near zero |

Code and structured output have a highly predictable next token, so even an imperfect draft agrees with the verifier most of the time; the EAGLE-3 lesson puts acceptance above 0.9 on such output. Open-ended prose at a high temperature has many acceptable continuations, and the draft rarely picks the one the verifier would.

### The greedy case

With temperature zero both models are deterministic. The test reduces to `argmax(q) == d`: accept on a match, otherwise output `argmax(q)` and stop. The residual distribution is not needed, because the verifier's choice is a single token.

### What to do about it

- Switch speculation off per request when the temperature is high, or route such requests to a plain decode pool; the EAGLE-3 lesson lists temperature-aware switching as a tuning knob.
- Do not spend the draft on very short outputs of 1 to 5 tokens either; the overhead dominates.
- Measure the acceptance rate per product surface and keep speculation where it pays; the production lesson's floor is about 0.55 at high concurrency.

## Follow-ups

- **Level 2:** What does the acceptance ratio become when the draft and the verifier agree exactly? Expected: one, so every draft is accepted and each pass yields the full draft plus the bonus token.
- **Level 3:** May the draft sample at a different temperature from the verifier? Expected: yes, as long as p is the distribution the draft actually sampled from; the output still follows the verifier's distribution, but a mismatch lowers acceptance.
- **Level 3:** How would you implement the switch in a serving layer? Expected: read the request's temperature and output length, and disable speculation above a temperature threshold or below a length threshold, with the thresholds set from measured acceptance.
- **Level 4:** Why is the loss worse at high concurrency than the formula suggests? Expected: a rejected draft costs a verify and a re-roll that serialize under a full batch, and the batch already fills the memory bandwidth that speculation was exploiting, so the tail latency suffers.

## Wrong answers

- "Lower the temperature so speculation works." The product chose the temperature for a reason; change the decoding path for those requests, not the product.
- "The draft is too small; use a bigger draft." Size is not the issue when the target distribution is flat; a larger draft still cannot guess which of many acceptable tokens the verifier samples.
- "At high temperature speculation changes the output." The rejection rule keeps the output distribution exact at any temperature; what changes is the speed.

## Taught in

The [Phase 7 speculative decoding lesson](../../../phases/07-transformers-deep-dive/16-speculative-decoding/) ties acceptance to the decoding strategy, the [Phase 10 speculative decoding lesson](../../../phases/10-llms-from-scratch/25-speculative-decoding/) gives the greedy case and the workload table, the [EAGLE-3 lesson](../../../phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) names the switching knob, and the [production EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) sets the acceptance floor.
