---
id: speedup-from-alpha
title: From acceptance rate to tokens per pass
card: tokenization-decoding
kind: estimate
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, system-design]
tags: [speculative-decoding, acceptance-rate, draft-length, speedup, estimation]
minutes: 10
lessons: [phases/10-llms-from-scratch/25-speculative-decoding, phases/10-llms-from-scratch/15-speculative-decoding-eagle3, phases/07-transformers-deep-dive/16-speculative-decoding, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding]
manuals: []
practice: [speculative-decoding-acceptance]
cheatsheet: [speculative-decoding]
related: [tokenization-decoding/read-the-speculative-step]
updated: 2026-11-03
---

A draft is accepted 80 percent of the time per token and proposes four tokens per step. How many tokens does one pass of the big model produce on average, how does the draft's own cost enter, and when does a longer draft stop paying?

## Short answer

The expected tokens per verifier pass are `(1 - alpha^(K + 1)) / (1 - alpha)`; at an acceptance of 0.8 and K of 4 that is 3.36, so about 3.36 times fewer big-model calls. The wall time per token is `(K c + 1)` over that expectation, where c is the draft's cost relative to the verifier, so a longer draft adds cost linearly while the geometric series saturates; at 0.8 acceptance and c of 0.05 the optimum sits around 5 to 7 drafts for about 3.2 times. The lever that matters is the acceptance rate: at a fixed K, a rise from 0.6 to 0.9 about doubles the expected tokens per pass.

## Full answer

### The formula

Each drafted token is accepted independently with probability alpha, and the step ends on the first rejected token, so the number of accepted drafts is a truncated geometric variable. Add the bonus token on full acceptance and the expectation is

```text
E[tokens per verifier pass] = (1 - alpha^(K + 1)) / (1 - alpha)
```

| alpha | K | tokens per pass |
|---|---|---|
| 0.8 | 4 | 3.36 |

At a fixed K, a higher alpha raises every term of the series, so the expectation climbs steeply as alpha nears one.

### Where the draft's cost enters

One step costs K draft forwards plus one verifier forward, `K c + 1` in verifier units. Divide by the expected tokens and you have the time per token. For a verifier at about 30 ms and a draft at about 3 ms, five drafts plus one verify is about 45 ms per step. The step emits between one and six tokens, so divide the 45 ms by the expected tokens per pass and compare the result with 30 ms for one plain token. As K grows the numerator grows linearly and the expectation flattens toward `1 / (1 - alpha)`, so there is an optimum.

| alpha | c | best K | speedup |
|---|---|---|---|
| 0.8 | 0.05 | about 5 to 7 | about 3.2 times |
| 0.95 | 0.02 | about 8 to 10 | toward 5 times |

### What moves alpha

How close the draft's distribution is to the verifier's, which is a function of how the draft was built; the sampling temperature, where greedy against greedy accepts most; and the task, where code and structured output accept more than free-form prose.

### Where the formula stops being the whole story

At high concurrency the verify pass is no longer free: the decode batch already fills the memory bandwidth, and a rejected draft costs a verify and a re-roll. The production lesson's rule is that below an acceptance of about 0.55 speculation is net negative at high concurrency, so measure alpha on real traffic before you set K.

## Follow-ups

- **Level 3:** At an acceptance of 0.95 and a draft cost of 0.02, where is the optimum? Expected: around 8 to 10 drafts, with the speedup pushing toward 5 times.
- **Level 3:** Why does the expectation saturate as K grows? Expected: it is a geometric series; the probability that all drafts up to position K are accepted falls as alpha to the K, so late positions add almost nothing.
- **Level 4:** How does batch size change the arithmetic? Expected: the verifier's extra work per draft is no longer hidden behind idle bandwidth, so the effective cost of verification and of a rejection rises, and the break-even acceptance climbs toward 0.45 to 0.55.
- **Level 4:** What single measurement do you add to the dashboard? Expected: accepted draft tokens divided by proposed draft tokens, per traffic slice, so alpha is visible where the formula needs it.

## Wrong answers

- "The speedup equals the draft length." Only if every draft is accepted; the geometric series and the draft cost cut it well below K.
- "Doubling K doubles throughput." Beyond the optimum the extra drafts are mostly rejected and their cost is paid anyway.
- "A draft ten times cheaper gives ten times the speedup." The draft cost sets c; the acceptance rate sets the expectation, and a cheap draft that is often wrong gains little.

## Taught in

The [Phase 10 speculative decoding lesson](../../../phases/10-llms-from-scratch/25-speculative-decoding/) derives the expectation, the [EAGLE-3 lesson](../../../phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) adds the draft cost and the optimum, the [Phase 7 speculative decoding lesson](../../../phases/07-transformers-deep-dive/16-speculative-decoding/) gives the millisecond example, and the [production EAGLE-3 lesson](../../../phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) sets the break-even.
