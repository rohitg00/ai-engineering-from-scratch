---
id: per-token-or-per-minute
title: Per-token or per-minute billing for a daytime load
card: cost-capacity
kind: tradeoff
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [system-design, customer]
tags: [pricing, utilization, dedicated-capacity, inference-platforms]
minutes: 8
lessons: [phases/17-infrastructure-and-production/02-inference-platform-economics, phases/17-infrastructure-and-production/01-managed-llm-platforms]
manuals: []
practice: []
cheatsheet: [managed-llm-platforms]
related: [cost-capacity/warm-pool-or-cold-start, cost-capacity/batch-lane-triage]
updated: 2026-11-03
---

Two inference platforms quote you for the same open model. One bills per million tokens. The other rents a dedicated GPU by the minute. Your traffic is steady through the working day and near zero at night. Which pricing wins, and what number decides it?

## Short answer

Sustained utilization decides it. Per-token billing charges only for what you use, so it wins when traffic is bursty or low and a dedicated GPU would sit idle. Per-minute billing charges for wall-clock time, so it wins once you keep the GPU busy, and the lesson's rule of thumb puts the crossover near 30 percent sustained utilization. A load that runs only in the daytime sits near that line, so measure your utilization over a full week before you sign.

## Full answer

### Two cost functions for one output

Per-token pricing reflects the platform's own utilization curve across all of its customers, and you pay for no idle time. Per-minute or per-second pricing reflects exclusivity: the GPU is yours, and the bill runs whether or not a request arrives. The output, a model response, is the same.

### The crossover

The economics lesson states the rule: above about 30 percent sustained utilization of a dedicated GPU, per-minute starts to beat per-token. Below it, per-token wins because you are not paying for idle. The lesson on managed platforms shows the same shape for reserved capacity on a hyperscaler: the break-even sits around 40 to 60 percent sustained utilization, savings reach up to 70 percent at high utilization, and the reservation is billed when idle.

### Compute it for your own traffic

1. Take the request count per hour of the day for a week, and the tokens per request.
2. The per-token bill is the token total times the rate.
3. The per-minute bill is the rented hours times the rate. That is every hour unless you scale to zero at night, which brings a cold start every morning.
4. Utilization is the busy time divided by the rented time. Compare it with the crossover.

### What the price does not show

- Dedicated capacity avoids queueing behind other tenants. The lesson on managed platforms measures a lower first-token median on reserved capacity than on shared on-demand for the same model class.
- A fine-tuned model can change the per-token price. One platform in the lesson serves a fine-tune at the base model's rate, which is a differentiator. A dedicated GPU serves it at the same hourly price either way.
- Non-interactive work has a third option: a batch tier at about half the serverless rate.

### A mixed answer

Rent dedicated capacity for the daytime floor, and send the overflow and the overnight batch to per-token or batch pricing. The utilization of the dedicated part then stays high, and the bursts never pay for an idle GPU.

## Follow-ups

- **Level 2:** Why does per-token pricing cost more per token than your own GPU time at high utilization? Expected: the platform's margin and its idle time are built into the per-token rate. At high utilization you pay for idle that you do not have.
- **Level 2:** What changes when you scale the dedicated GPU to zero at night? Expected: you stop paying for the night and buy a cold start every morning, so the first requests of the day pay in latency.
- **Level 3:** Why is the dedicated option faster at the tail? Expected: shared on-demand capacity competes with every other customer's traffic, and dedicated capacity does not. That is the gap the lesson on managed platforms measures between reserved and on-demand first-token latency.
- **Level 3:** How does a fine-tuned model change the comparison? Expected: a per-token platform may serve the fine-tune at the base rate or charge a premium for it. A dedicated GPU serves it at the same hourly price either way.

## Wrong answers

- "Per-token is always cheaper because you never pay for idle." Above the utilization crossover, the per-token rate carries the platform's idle and margin, and your own GPU is cheaper.
- "Dedicated is always cheaper at scale." Only when you keep it busy. A daytime-only load leaves it idle half the time.
- "Compare the headline prices." The two prices have different units. Only your traffic profile turns them into a bill.

## Taught in

The [inference platform economics lesson](../../../phases/17-infrastructure-and-production/02-inference-platform-economics/) gives the per-token against per-minute crossover, and the [managed platforms lesson](../../../phases/17-infrastructure-and-production/01-managed-llm-platforms/) gives the break-even for reserved capacity.
