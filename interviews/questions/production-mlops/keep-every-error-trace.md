---
id: keep-every-error-trace
title: Trace retention when traces cost more than the model
card: production-mlops
kind: design
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [tracing, sampling, retention, observability-cost]
minutes: 10
lessons: [phases/17-infrastructure-and-production/13-llm-observability, phases/19-capstone-projects/11-llm-observability-dashboard]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/renamed-token-attribute, production-mlops/drift-score-on-prompts]
updated: 2026-11-03
---

Your service makes more than a million model calls a day. Keeping every trace now costs more than the model calls themselves. Design a retention policy that keeps the traces you will need during an incident and drops the rest.

## Short answer

Sample by rule, not by a flat rate. Keep every errored trace and every high-cost trace, keep a small share of the successes, and keep the aggregates always. Make the decision at the collector with a tail sampler after the trace completes, so that the rule can see the status and the cost. The capstone keeps all errored traces and 10 percent of the successes.

## Full answer

### Why a flat rate fails

A flat 5 percent keeps 5 percent of the errors too. The trace you need in an incident is the one you dropped, and the aggregate error count tells you only that it existed.

### The rules

| Class | Keep |
|---|---|
| errored traces | all of them |
| high-cost traces, long outputs or expensive models | all of them |
| successes | 5 to 10 percent |
| aggregates | always, from every request |

The observability lesson states the rule as 100 percent of errors, 100 percent of high cost and 5 percent of successes. Aggregates do not need traces: counters and histograms count every request even when the trace is dropped.

### Decide at the tail

Head sampling decides when the trace starts, before anything knows whether it will fail. Tail sampling at the collector decides after the trace completes, so it can read the status, the cost and the eval score. The price is buffer memory at the collector, because whole traces wait until the decision.

### Stratify, and know the bias

The capstone's exercise keeps every trace with a toxicity score above 0.5 plus a 10 percent stratified sample of the rest, and asks you to measure the bias that the sampling adds. Any analysis over sampled traces overweights the classes you kept in full. Weight by the inverse of the sampling rate, or run the per-trace evals on the stratified share only.

### Tier the storage

Spans go to a columnar store for queries, and raw events go to object storage for the long tail. The archive is cheap, and long-term analysis runs there.

## Follow-ups

- **Level 2:** Why does head sampling lose the errors? Expected: it decides before the span ends, so it cannot see the status.
- **Level 2:** What survives from a dropped trace? Expected: the metrics. Counters and histograms count every request, whether or not its trace is kept.
- **Level 3:** Your eval jobs run over the sampled traces. What bias do they inherit? Expected: a sample that keeps all errors overweights failures, so weight by the inverse sampling rate or evaluate the stratified share only.
- **Level 3:** The collector runs out of memory during a burst. Why, and what do you change? Expected: tail sampling buffers whole traces until they complete. Cap the buffer, shorten the decision wait, and shed with a head rule under pressure.

## Wrong answers

- "Sample 5 percent of everything." Most of the errors you need in an incident are gone, and the aggregate tells you only that they happened.
- "Keep everything for a week, then delete it." A week of full traces at this volume is the cost you are trying to remove.
- "Traces are enough, drop the metrics." A percentile over an hour needs every request, which only a histogram gives.

## Taught in

The [observability stack lesson](../../../phases/17-infrastructure-and-production/13-llm-observability/) gives the sampling rules, and the [dashboard capstone](../../../phases/19-capstone-projects/11-llm-observability-dashboard/) configures the tail sampler and measures its bias.
