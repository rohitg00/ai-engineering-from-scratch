---
id: canary-samples-at-one-percent
title: How many samples a one percent canary gives a gate
card: production-mlops
kind: estimate
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [screen, system-design]
tags: [canary, sample-size, release-gates, metrics-cadence]
minutes: 8
lessons: [phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/canary-gates-above-noise]
updated: 2026-11-03
---

Your service handles 1,000 requests per minute. The canary opens at one percent, and the gate runs every five minutes. About how many data points does one gate check see, and which gates can you trust at this step?

## Short answer

One percent of the 1,000 per minute is 10 requests per minute to the canary, so a five-minute window holds about 50 points and a fifteen-minute window about 150. That is enough to read latency and error rates, and far too few to read user feedback. Gate the first step on latency, cost, errors and output length, and apply the feedback gate at a later step.

## Full answer

### The arithmetic

The lesson's cadence is a gate check every 5 to 15 minutes, depending on volume. At 1 percent of a 1,000 per minute load, the canary receives 10 requests per minute, which gives 50 to 150 data points per window.

### What each gate needs from those points

| Gate | At about 50 points |
|---|---|
| Latency P50 and P95 | readable, with a wide band |
| Latency P99 | one or two samples decide it, so hold more than one window |
| Cost per request | every request reports its tokens, so a large shift shows |
| Error and refusal rate | a baseline of a few percent gives a handful of events, so it is noisy |
| Output length distribution | rough, but a large shift shows |
| User feedback | only some users rate an answer, so a window holds a few ratings at most |

### The next step changes the picture

At 10 percent the canary sees about ten times more points per window. The feedback gate becomes usable there. This is why the progression pauses at each step: the pause is not a formality, it is the time the gate needs to collect its samples.

### Write the dwell rule down

For each step, state the number of windows that must pass with every gate green before the share rises. A gate that needs two windows to confirm a breach doubles the exposure of a real regression, so write that trade-off next to the rule.

## Follow-ups

- **Level 2:** At which step does the user feedback gate become usable? Expected: at 10 percent, where the canary sees about ten times more points per window.
- **Level 2:** Why does a longer window not fix the first step? Expected: a longer window adds points slowly, and a regression runs for the whole window before the gate can fire.
- **Level 3:** Traffic falls to a tenth at night. How does the plan change? Expected: the same share gives about one request per minute, so lengthen the dwell, start at a higher share, or run the ramp during the day.
- **Level 3:** A breach must hold for two windows before the gate fires. What does that cost? Expected: a real regression keeps running through both windows until the halt, so the rule trades fewer false alarms for a longer exposure.

## Wrong answers

- "One percent is safe, so the gates work at one percent." The share is safe for users, and most gates are blind at that sample size.
- "Check every minute for faster detection." A one-minute window at this step holds about ten points, which cannot give a percentile.
- "Start at 25 percent for better statistics." A quarter of the users see the new model before any gate has fired once.

## Taught in

The [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) gives the metrics cadence and the sample counts per window.
