---
id: batch-vs-online-serving-choice
title: Batch or online serving for a two-hour freshness limit
card: system-design
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design]
tags: [batch-inference, online-inference, staleness, cost]
minutes: 12
lessons: [phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [ml-system-design]
related: [system-design/churn-model-system, system-design/fraud-check-100ms]
updated: 2026-11-03
---

A feed ranking score must be no more than two hours old for 5,000,000 items, and the serving peak is 120 requests per second. Price batch and online serving with the lesson's cost model, pick one, and say what would flip the choice.

## Short answer

With a one-hour batch job and a two-hour staleness limit, the job must run every hour, which the lesson's cost model prices at 24.0 runs per day over 5,000,000 items for $48.50 a day. Two online replicas sized for 120 peak QPS cost $24.00 a day and serve the freshest data. Online wins here; the choice flips when the freshness limit relaxes enough to cut the runs, or when peak traffic grows enough to need many replicas.

## Full answer

### How each plan is priced

| Property | Batch | Online |
|---|---|---|
| Freshness | As old as the last run plus the run time | The data of the request |
| Request latency | One key-value read, a few milliseconds | Feature fetch plus model time, 35 ms in the model |
| Cost driver | Entities times runs per day | Replicas sized for peak QPS, minimum of two |
| New entities | No score until the next run | Scored on the first request |
| When it breaks | Old scores stay readable | Requests fail or time out |

Batch must finish inside the staleness limit, so the time between runs is the limit minus the job time. Each run scores every entity whether or not anyone asks. Online pays for idle replicas between peaks, with a floor of two for availability.

### The arithmetic for this workload

The staleness limit of two hours minus a one-hour job leaves one hour between runs, so 24.0 runs per day. Every run scores all 5,000,000 items. That is why the batch plan costs $48.50 a day while the online plan sits at its two-replica floor of $24.00, since 120 peak QPS fits inside the capacity of two replicas.

### What flips it

- A longer staleness limit cuts runs and batch cost in proportion; the nightly churn job in the same lesson costs under a dollar.
- A staleness limit shorter than one batch job makes batch infeasible at any price.
- A much higher peak needs more replicas and raises online cost linearly with peak traffic.
- A latency budget below the online path's model time rules online out, and a hybrid serves known items from a store and new items online.

### What the decision is not about

Freshness and cost decide; model quality does not change between the two plans. The failure modes differ: a broken batch job leaves old but readable scores, while a broken online service fails requests, so the online design needs a default such as the last stored score or the heuristic.

## Follow-ups

- **Level 2:** Why is the online plan at its minimum here? Expected: two replicas is the availability floor, and 120 peak QPS fits inside what two replicas handle, so traffic does not drive the count.
- **Level 2:** The job takes longer than the staleness limit. What does the planner return? Expected: infeasible; no schedule satisfies the limit, so the budgets or the job must change.
- **Level 3:** Design the hybrid. Expected: batch scores known items on the relaxed schedule, online scores new items and requests that need fresh data; price it as the sum of a cheaper batch plan and a small online tier.
- **Level 3:** Which design document check does this feed? Expected: the serving-fit check, which prices the chosen mode against the staleness, latency and cost budgets and fails a mode that misses any of them.

## Wrong answers

- "Batch is always cheaper." Batch cost scales with runs per day times entities; a tight freshness limit makes it the expensive plan.
- "Online is always fresher, so always better." Fresher costs replicas, and a nightly process cannot use freshness it does not read.
- "Pick by model accuracy." Accuracy is the same in both plans; the choice is about freshness, latency and cost.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) builds the batch and online cost model and runs it on the feed ranking workload.
