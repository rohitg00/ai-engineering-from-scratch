---
id: hit-rate-gauge-lies
title: Two cache hit rates from one scrape
card: cost-capacity
kind: debug
level: 2
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [debugging, ml-breadth]
tags: [metrics, prefix-cache, prometheus, gauges]
minutes: 8
lessons: [phases/17-infrastructure-and-production/14-prompt-semantic-caching]
manuals: [sglang-101#s-the-metrics-endpoint]
practice: []
cheatsheet: [sglang-serving, llm-cost-caching]
related: [cost-capacity/two-cache-layers, inference-serving/prefix-cache-order]
updated: 2026-11-03
---

A dashboard panel shows the prefix cache hit rate of a self-hosted server at 94 percent. Over the same run, the server's counters say that it computed 104,057 prompt tokens and took 182,079 from the cache. Both readings come from one scrape of the same endpoint. Which one do you trust for a cost decision, and why do they differ?

## Short answer

Trust the counters. The gauge holds the hit rate of the last prefill interval that the scheduler logged, and at idle it keeps the value from the last batch, which was a shared-prefix benchmark. The counters add up every prefill token since the server started, and their ratio over the whole run is 0.636, not 0.942. For a cost decision, compute the rate from the counters over a time window.

## Full answer

### Three kinds of series

A gauge is a value the scheduler overwrites on each log interval. A scrape sees the latest value only. A counter is a total that only grows, and you read it as a rate over a window. A histogram is a set of counters, one per bucket, and you read percentiles from it over a window.

### The two hit rates

The gauge divides the hit tokens of one log interval by the hit tokens plus the computed tokens of that interval. When nothing runs, it keeps its last value. The counters carry the same two quantities since startup, split by mode: input for computed tokens, and device, host and storage hits for cached tokens. Over the whole run, 182,079 cached tokens against 286,136 prefill tokens in total give 0.636. The gauge at 0.942 describes the shared-prefix benchmark that ran last. Both are correct, and they answer different questions.

### The windowed rate

The HELP text of the counter gives the formula, and in PromQL it reads:

```promql
sum(rate(sglang:prefill_effective_tokens_total{mode=~".*_hit"}[5m]))
  / sum(rate(sglang:prefill_effective_tokens_total[5m]))
```

One caveat from the code: the hit modes add raw hit counts, so after a retraction the same tokens can count twice. The input mode excludes the re-count. The manual's run had no retractions, so its numbers are exact.

### Why this is a cost question

A hit rate decides whether you restructure prompts, add a cache-aware router or buy memory. A gauge from the last benchmark says the prompts are fine. The counters say that more than a third of the prompt tokens over the run were computed. The lesson on caching economics says the same for provider caches: measure your own hit rate from the usage fields on every response, and do not take a published figure as yours.

### What to alert on

Alert on counters and histograms over a window. Alert on a gauge only when the condition lasts for several minutes, such as queued requests above zero or token usage near one. Read the HELP text and the code before you build a panel on a metric. The manual found one utilization gauge that stays at zero at the version it pinned.

## Follow-ups

- **Level 2:** What does a gauge answer, and what does a counter answer? Expected: a gauge answers what happened in the last interval. A counter answers how much happened since the start, and a rate over a window turns it into a trend.
- **Level 3:** Why can the counter-based rate overstate the hits after retractions? Expected: the hit modes add raw hit counts, so a retracted request that runs again counts its cached tokens twice, while the input mode excludes the re-count.
- **Level 3:** Which gauges may page you, and under what rule? Expected: queued requests above zero and token usage near one, only when the condition holds for several minutes, never on one scrape.
- **Level 4:** A panel on this server shows utilization at zero during an outage. Why? Expected: that gauge stays at zero at the pinned version because of a known regression, so the panel shows an idle fleet. Read the HELP text and the code before building on a metric.

## Wrong answers

- "The gauge is the newest value, so it is the most accurate." It is a snapshot of one interval, and it keeps its last value at idle.
- "Average the two numbers." They answer different questions, and the counters already contain the whole run.
- "The real rate is lower, so turn the cache off." A rate of 0.636 means a third of the prompt tokens were computed. The fix is the prompt layout or the routing, not the cache.

## Taught in

The [metrics endpoint section of SGLang 101](../../../manuals/sglang-101/sections/5-2-the-metrics-endpoint.md) measures the two hit rates on one server, and the [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) tells you to compute the rate from your own usage fields.
