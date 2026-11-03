---
id: cost-attribution-take-home
title: Build a cost attribution and enforcement simulator
card: cost-capacity
kind: take-home
level: 4
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [take-home, system-design]
tags: [finops, attribution, kill-switch, multi-tenant]
minutes: 60
lessons: [phases/17-infrastructure-and-production/27-finops-llms, phases/11-llm-engineering/11-caching-cost]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/cost-per-outcome, cost-capacity/budget-circuit-breaker]
updated: 2026-11-03
---

Take-home. You receive one day of request logs from a multi-tenant assistant. Each record follows the lesson's attribution trace: a trace id, a timestamp, the tenant, the user, the task id and its route, the model, the token counts for each of the four layers in the lesson's trace, whether the input was cached, and whether the task was resolved. You also receive the daily spend of each tenant over the previous weeks, as the baseline for the kill switch. Build a simulator that attributes spend by tenant, task and user, splits the tokens into layers, computes a cost per resolved task per tenant, and enforces a rate limit, a daily spend cap and a kill switch. Inject one abusive tenant and show when each control fires.

## Short answer

Price every call from a pricing table, roll the cost up by tenant, by task with its route and by user, and split the tokens into prompt, tool, memory and response so that the report names the layer that drives each tenant's spend. Compute the cost per resolved task from the outcome field, not from the token totals. Implement the ladder from the lesson: a rate limit at 2 to 3 times the expected peak, a daily cap at 1.5 to 3 times the contracted ceiling, and a kill switch on a spend z-score above 4 against the tenant's own baseline. Show the abusive tenant hit the rate limit first, then the cap, then the kill switch when its spend jumps far above its history.

## Full answer

### What a complete submission contains

1. **A cost on every call.** A pricing table with the cached input price, as the earlier caching lesson builds it, and a function that turns tokens into dollars per call.
2. **Attribution in three dimensions.** Spend by tenant, by task and route, and by user, joined by the trace id as the telemetry joiner pattern does. Nothing is inferred after the fact.
3. **Four token layers.** Prompt, tool, memory and response per task, as shares. The lesson's typical bands are the sanity check: prompt 40 to 60 percent, tool 20 to 40 percent on agent work, memory and response 10 to 30 percent each.
4. **The unit metric.** For every tenant and every feature, the spend divided by the resolved tasks, from the resolution field. A task that was not resolved still cost money, and that is the point of the metric.
5. **The enforcement ladder.** The rate limit answers with a 429 and a retry header. The cap tightens the rate limit and raises an alert. The kill switch pauses the tenant and pages.
6. **The injected tenant.** A timeline of its spend and of the control that fired at each point, with the z-score plotted against the threshold.
7. **The first five dashboard views.** The lesson's exercise asks for them. A strong answer: spend per tenant over time, the per-tenant spend divided by resolved tasks, the layer split per task, the top users by spend, and the enforcement events.

### What the reviewer looks for

- The attribution is stamped at request creation and joined by trace id, never guessed from the bill.
- The layers are separate, and the report says which one to fix for each heavy tenant.
- The unit metric is tied to an outcome.
- The kill switch is relative to the tenant's own baseline, and the threshold is justified, which is the lesson's first exercise.
- The order of the controls is explained: friction first, pause last.

### What to argue in the write-up

The lesson's third exercise: the largest tenant has a negative margin. Propose three interventions ordered by customer impact, such as caching and routing on their heaviest task first, a quota change second, and a price change at renewal last. Then argue whether retroactive tagging can ever work, which the lesson asks in its last exercise. The honest answer is that it fills a gap for legacy data and always misses cases.

## Follow-ups

- **Level 3:** Why is the kill switch relative to each tenant's history instead of a fixed amount? Expected: tenants differ by orders of magnitude. A fixed amount pauses a large tenant on a normal day and never fires for a small one.
- **Level 4:** Your largest tenant is unprofitable in the report. What do you propose? Expected: three interventions ordered by customer impact, such as caching and routing on their heaviest task, then a quota change, then a price change at renewal.
- **Level 4:** Which five views would you put on the dashboard first? Expected: spend per tenant over time, the per-tenant spend divided by resolved tasks, the layer split per task, the top users by spend, and the enforcement events timeline.

## Wrong answers

- "Attribute the bill by dividing it by seats." That hides the heavy tenants and the heavy features, which is what the exercise is for.
- "One token bucket for everything." A single bucket cannot say which layer or tenant to fix, and it cannot carry a per-tenant cap.
- "Fire the kill switch at a fixed dollar amount." Tenants differ by orders of magnitude. A fixed amount is wrong for all but one of them.

## Taught in

The [FinOps for LLMs lesson](../../../phases/17-infrastructure-and-production/27-finops-llms/) defines the attribution dimensions, the token layers and the enforcement ladder, and the [caching and cost lesson](../../../phases/11-llm-engineering/11-caching-cost/) supplies the pricing table and the cost tracker.
