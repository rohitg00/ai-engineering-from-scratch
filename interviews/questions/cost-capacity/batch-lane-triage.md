---
id: batch-lane-triage
title: Sort a workload into interactive, async or batch
card: cost-capacity
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [batch-api, workload-triage, latency-sla, cost]
minutes: 5
lessons: [phases/17-infrastructure-and-production/15-batch-apis]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/two-cache-layers]
updated: 2026-11-03
---

A team runs its nightly report pipeline through the same synchronous endpoint as the chat product, because the pipeline is production. How do you classify model workloads, and where does this one belong?

## Short answer

Sort every workload by the latency its user accepts, not by where it runs. Interactive work has a user waiting for the first token and stays synchronous with prompt caching, and semi-interactive work returns in minutes through an async queue. Anything whose user can wait for the full promise belongs on the batch API, which gives a 50 percent discount with a return promised within 24 hours and typical in a few hours. The nightly report is batch when a return at the 24-hour limit still meets its deadline, or when a synchronous fallback covers a late batch.

## Full answer

### The three lanes

| Lane | The user | The path |
|---|---|---|
| interactive | waits for the first token | synchronous, with prompt caching |
| semi-interactive | submits and checks back in minutes | async queue, with a synchronous fallback |
| batch | expects the result by morning or end of day | batch API, with cached input stacked on top |

### The misclassification

The lesson's rule is blunt: production is not a latency spec, the SLA is. The common mistake is to call everything interactive because it runs in production. Its cousin is the partial-interactivity trap: a report with a refresh button that users happily wait ten minutes for, shipped as a synchronous call. The lesson puts 50 concurrent refreshes at 10x the cost of the same report batched and delivered by mail.

### What batch promises

A return within 24 hours, with a typical return of a few hours, because the provider runs the batch when its capacity is idle. The lesson calls this asynchronous, not slow.

### Stack it with caching

A nightly pipeline shares one system prompt across every call. Cache that prefix, run the pipeline on batch, and the lesson's arithmetic lands near 10 percent of the synchronous uncached cost. Its opening example takes a nightly pipeline from a four-hour synchronous run to a batch run at about 9 percent of the bill with three configuration changes.

### The other trap

Batch file formats differ per provider, so one batch client needs an adapter per provider, and a gateway that advertises multi-provider batch still wraps the raw formats.

## Follow-ups

- **Level 1:** Which question sorts a workload into a lane? Expected: what a wait of a day means to this user. If they would not notice, it is batch.
- **Level 2:** A user clicks refresh on a health report and waits ten minutes without complaint. Which lane? Expected: semi-interactive at most, and batch if the report can arrive by mail. Shipping it synchronous is the partial-interactivity trap.
- **Level 2:** Why does the lesson call batch asynchronous rather than slow? Expected: the promise is a return within a day, and the typical return is a few hours, because the provider runs it when capacity is idle.
- **Level 3:** What breaks when you write one batch client for two providers? Expected: the file formats differ, so you need an adapter per provider.

## Wrong answers

- "It runs in production, so it is interactive." Production is where it runs. The lane comes from the latency the user accepts.
- "Batch means the answer takes a day." The promise is within a day. The typical return is a few hours.
- "A 50 percent discount is not worth the complexity." On a shared prefix it stacks with caching to about a tenth of the synchronous cost, which the lesson calls the cheapest lever that nobody pulls.

## Taught in

The [batch APIs lesson](../../../phases/17-infrastructure-and-production/15-batch-apis/) defines the three lanes and the two traps.
