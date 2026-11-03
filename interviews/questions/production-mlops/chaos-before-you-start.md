---
id: chaos-before-you-start
title: What must exist before the first chaos experiment
card: production-mlops
kind: concept
level: 1
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [screen, system-design]
tags: [chaos-engineering, slo, runbooks, on-call]
minutes: 6
lessons: [phases/17-infrastructure-and-production/24-chaos-engineering-llm]
manuals: []
practice: []
cheatsheet: [sre-for-ai]
related: [production-mlops/budget-burn-pauses-chaos, production-mlops/rollback-without-redeploy]
updated: 2026-11-03
---

A new team wants to run its first chaos experiment against the model service next week. What do you check for before you agree, and what goes wrong when one piece is missing?

## Short answer

Five things have to be in place: service level indicators with objectives, observability with traces, metrics and logs, an automated rollback, structured runbooks and an on-call owner. Each one lets you measure the experiment, stop it or repair the damage. When one is missing, the experiment is not a test. It is an incident that you scheduled.

## Full answer

### The five prerequisites

1. **SLI and SLO.** Without a target you cannot say whether the experiment hurt anything.
2. **Observability.** Traces, metrics and logs on a dashboard. You must see the effect while it happens.
3. **Automated rollback.** The policy-flag rollback from the progressive delivery lesson. A rollback that needs a redeploy is too slow for an experiment.
4. **Runbooks.** Structured sections: symptom, hypothesis, verify, act. The on-call reads them under pressure.
5. **On-call.** Someone who responds when the experiment finds something.

### The first experiments

Start with one pod kill of a decode replica under steady traffic, and watch the rerouting and the recovery. If that looks safe, graduate to network chaos. The first model-specific experiment is one provider returning rate-limit errors for a few minutes, to see the fallback engage. Most teams learn here that their fallback was never fully tested.

### The cadence

Weekly small experiments in staging or on a small share of production. Monthly game day on one scenario with a postmortem. Quarterly cross-team audit with a dependency map.

## Follow-ups

- **Level 1:** Which experiment goes first, and why? Expected: kill one decode replica under steady traffic, because it tests rerouting and recovery with a small blast radius.
- **Level 2:** Name one failure a generic network chaos tool cannot reproduce for a model service. Expected: a KV cache eviction storm under burst load, or a prompt that stalls the tokenizer.
- **Level 2:** Why does the rollback matter more than the dashboard during an experiment? Expected: the dashboard shows the harm, and the rollback stops it. Without the rollback the harm continues until someone fixes it by hand.
- **Level 3:** The team wants staging only. When is production the right place? Expected: when staging cannot reproduce the traffic shape, the cache state or the provider behavior, and only with the safety guards in place.

## Wrong answers

- "Skip the prerequisites and learn by doing." Without an SLO, a rollback and an on-call owner, the experiment is an outage that you caused on purpose.
- "A dashboard is observability." Chaos needs traces, metrics and logs with trace-id correlation, so that you can tell experiment failures from natural ones.
- "Run the biggest experiment first to find the biggest risk." Start with one replica kill, then grow the blast radius.

## Taught in

The [chaos engineering lesson](../../../phases/17-infrastructure-and-production/24-chaos-engineering-llm/) lists the five prerequisites, the four planes and the first experiments.
