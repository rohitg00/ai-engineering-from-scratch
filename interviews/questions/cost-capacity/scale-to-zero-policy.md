---
id: scale-to-zero-policy
title: Warm replicas per tier, with the arithmetic
card: cost-capacity
kind: design
level: 4
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [warm-pool, scale-to-zero, cold-start, tiers]
minutes: 18
lessons: [phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/02-inference-platform-economics]
manuals: []
practice: []
cheatsheet: [llm-cost-caching, serving-engines-compared]
related: [cost-capacity/warm-pool-or-cold-start, cost-capacity/cold-start-anatomy, cost-capacity/per-token-or-per-minute]
updated: 2026-11-03
---

You run three tiers on a serverless GPU platform: paid users on a live chat, trial users on the same chat, and a nightly batch pipeline. Design the warm-pool policy per tier, show the arithmetic behind it, and say what you would measure after a month to revisit it.

## Short answer

Give the paid chat one or two warm replicas, because its first-token target cannot absorb a cold start of minutes on a large model. Give trial users a smaller margin, or let them ride on the paid pool's spare capacity, and let the batch pipeline scale to zero, because it tolerates a cold start of several minutes. The arithmetic is the hourly GPU price times the idle hours against the requests that would miss the target during a cold start, and after a month you compare the measured utilization, the cold-start count and the missed-target count per tier.

## Full answer

### The arithmetic the lesson gives

A warm replica costs one GPU hour every hour. One replica per product is a full month of GPU hours whether anyone calls, and the lesson's example of five products with one warm replica each comes to 3,600 GPU-hours a month idle. The lesson calls the trade brutal on small models, where you pay 0.85 to 1.50 dollars an hour to avoid a 30 second start, and kind on large ones, where about 4 dollars an hour avoids a 5 minute start. Its threshold for a mandatory warm pool: a first-token target at P99 under 60 seconds on a model of 70B or more.

### The policy per tier

| Tier | Policy | Why |
|---|---|---|
| paid live chat | one to two warm replicas | the lesson's high-value interactive path, where a cold start is an outage |
| trial chat | zero warm, or overflow into the paid pool at lower priority | the loss is a conversion, which you can measure, against a month of GPU hours |
| nightly batch | scale to zero | the lesson accepts a cold start of 5 to 10 minutes on background paths |

The lesson's exercise asks exactly this split and asks for the math. The paid tier is decided by the SLA. The batch tier is decided by its tolerance. The trial tier is the real decision, and it is an experiment: the conversion loss from a cold start on the first session against the price of an idle GPU.

### Make the policy cheaper by shrinking the start

Every mitigation layer moves a tier toward zero. A pre-seeded node image removes the image pull, model streaming halves the weight load, a GPU memory snapshot restores the loaded state in a fraction of the time, and tiered loading keeps weights in host memory. The lesson's table takes a cold start of 328 seconds to about 15 seconds. With a 15 second start, the trial tier can scale to zero with a small loss, and the paid pool can hold one replica instead of two.

### Match the billing to the tier

The warm replicas run at high utilization, which is where per-minute billing beats per-token, above about 30 percent sustained utilization in the economics lesson. Trial bursts and the overnight batch sit below that line, so per-token or a batch tier at about half the serverless rate fits them.

### What to measure after a month

- Utilization per tier, hour by hour.
- Cold starts per day and their duration.
- Requests that missed the first-token target, and whether they fell inside a cold start.
- Trial conversions for sessions that hit a cold start against sessions that did not.
- The break-even request rate per tier from the lesson's simulator, against the measured rate.

## Follow-ups

- **Level 3:** Why not give trial users the same warm pool as paid users? Expected: a warm replica costs a month of GPU hours whether trial traffic arrives or not. The decision is the conversion loss from a cold start against that cost, and the month of measurement answers it.
- **Level 4:** How does a 15 second cold start change the policy? Expected: tiers that tolerate seconds scale to zero, so the warm pool shrinks to the paths with targets of a second or two.
- **Level 4:** Which signal says a warm replica count is too low? Expected: the share of requests that miss the first-token target during scale-outs, together with the cold-start count per day.

## Wrong answers

- "Warm replicas for every tier, the cost is small." One replica per product is a month of GPU hours each. Five products idle come to thousands of hours.
- "Scale trial to zero, those users are free." A cold start of minutes on the first trial session is a lost conversion. Measure it before you decide.
- "Keep the batch pipeline warm so that it finishes earlier." Batch tolerates minutes. A warm GPU for it is paid idle time for the rest of the day.

## Taught in

The [cold start lesson](../../../phases/17-infrastructure-and-production/10-cold-start-mitigation/) gives the warm-pool arithmetic and the tiered policy exercise, and the [inference platform economics lesson](../../../phases/17-infrastructure-and-production/02-inference-platform-economics/) gives the per-minute against per-token crossover.
