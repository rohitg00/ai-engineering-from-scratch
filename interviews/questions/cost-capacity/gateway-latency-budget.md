---
id: gateway-latency-budget
title: Which gateways fit in a 20 ms tail budget
card: cost-capacity
kind: estimate
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [ai-gateway, latency-budget, ttft, p99]
minutes: 8
lessons: [phases/17-infrastructure-and-production/19-ai-gateways]
manuals: []
practice: []
cheatsheet: [llm-routing-gateways]
related: [cost-capacity/budget-circuit-breaker]
updated: 2026-11-03
---

Your SLA is a P99 time to first token under 320 ms. The model alone measures 300 ms at P99. You are choosing a gateway to put in front of it. Which classes of gateway fit in the budget, and what do you do when the one you want does not?

## Short answer

The gateway has at most 20 ms at the tail. An edge-managed gateway at 1 to 3 ms and a high-performance gateway at 3 to 8 ms fit, a lightweight proxy at 5 to 15 ms fits with little margin, and a control-plane gateway at 20 to 40 ms does not. If you need the features of the slow one, split the roles: keep the fast gateway on the request path, run the heavy features out of band, or buy the budget back from the model with a faster first token.

## Full answer

### The budget

The target is 320 ms and the model takes 300 ms, so the gateway may add 20 ms, and that is at the tail. A P99 target means the gateway's own P99, not its median, and a gateway that is quick when idle can be slow under load. The sum of the two tails is a screening estimate only. Before you commit to the SLA, measure the end-to-end first-token P99 through the gateway under load.

### The classes

| Class | Overhead in the lesson | Fits |
|---|---|---|
| edge-managed, zero-ops | 1 to 3 ms | yes |
| high-performance, built on a mature API gateway | 3 to 8 ms | yes |
| lightweight open-source proxy | 5 to 15 ms | with little margin |
| control plane with guardrails and audit | 20 to 40 ms | no |

The lesson's rule of thumb matches: for a P99 under 100 ms, pick the edge or the high-performance class. For a P99 under 500 ms, any class works.

### When you want the slow one

The control-plane class brings PII redaction, jailbreak detection and audit trails. Three ways to keep them inside the budget:

1. Split the roles. Put the fast gateway on the request path and run observability and audit off the path. The lesson notes that production deployments combine an observability tool with a scale gateway in exactly this split.
2. Keep only what must be inline. Redaction has to run before the provider sees the prompt, so it stays on the path. Audit and tracing do not.
3. Buy back budget from the model. Prefix caching lowers the first-token time, and a faster model tier does too.

### Scale decides as well

The lightweight proxy breaks down around 2000 requests per second with an 8 GB footprint in the published benchmark, and the lesson places it below 500 requests per second. If the traffic will grow past that, the high-performance class is the only one that fits both the latency and the scale.

## Follow-ups

- **Level 2:** Why measure the gateway at P99 and not at its median? Expected: the SLA is a P99, and the gateway's tail adds to the model's tail.
- **Level 3:** The slow gateway's value is PII redaction. How do you keep it inside the budget? Expected: keep the redaction inline because it must run before the provider sees the prompt, move observability and audit off the path, and then measure whether the remaining overhead fits.
- **Level 3:** Traffic will triple next year. Which class survives? Expected: the lightweight proxy breaks down around 2000 requests per second, so plan the move to the high-performance class before that.

## Wrong answers

- "Every gateway adds a few milliseconds, pick on features." The lesson's overheads run from 1 to 40 ms, and 40 ms is twice this budget.
- "Put the gateway behind the model, not in front." The gateway routes and falls back before the model. Behind the model it protects nothing.
- "Add the gateway's median to the model's P99." Two tails do not add that way. Measure the gateway's own tail under load.

## Taught in

The [AI gateways lesson](../../../phases/17-infrastructure-and-production/19-ai-gateways/) gives the latency overhead per gateway class and the scale ceilings.
