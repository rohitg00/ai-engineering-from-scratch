---
id: budget-circuit-breaker
title: Controls that stop a bug from spending the month
card: cost-capacity
kind: design
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [budget, circuit-breaker, rate-limiting, finops]
minutes: 10
lessons: [phases/11-llm-engineering/11-caching-cost, phases/17-infrastructure-and-production/27-finops-llms]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/cost-per-outcome]
updated: 2026-11-03
---

Last month a bug in a retry loop spent the whole monthly model budget in two days, and nobody saw it until the invoice. Design the controls that stop the next one, with the thresholds and what each threshold does.

## Short answer

Put a cost tracker on every call and a ladder of thresholds on top of it. At 70 percent of the budget alert, at 85 percent throttle so that every request goes to the cheapest model, and at 95 percent stop so that only cached answers are served and new calls are refused. In front of the ladder, add a rate limit and a daily spend cap per tenant, and a kill switch that pauses a tenant whose spend jumps far above its own history.

## Full answer

### The tracker

Every call logs the timestamp, the model, the input and output tokens, the latency, the computed cost, the user, the cache status and the request category. The running total against the monthly budget is the input of every control below. A check that runs nightly is too slow, because a retry loop spends a day's budget in minutes.

### The budget ladder

| Share spent | Action |
|---|---|
| 70 percent | send an alert |
| 85 percent | throttle: route every request to the cheapest model |
| 95 percent | stop: serve cached responses only, refuse new requests |

Each step buys time for the next. The alert gives people a chance to act, the throttle keeps the service up at lower quality while the spend slows, and the stop protects the budget when nobody acted.

### The per-tenant ladder

The FinOps lesson gives three controls per tenant for a multi-tenant product:

1. A rate limit at 2 to 3 times the expected peak, with a rate-limit status and a retry header. The tenant feels friction and gets no surprise bill.
2. A daily spend cap at 1.5 to 3 times the contracted ceiling. Crossing it tightens the rate limit and alerts customer success.
3. A kill switch when the spend z-score against the tenant's own baseline passes 4. It pauses the tenant and pages on-call.

The z-score matters because tenants differ by orders of magnitude. A fixed amount is noise for a large tenant and a month of budget for a small one.

### Test the ladder

The caching lesson's exercise simulates 1,000 requests against a budget of 1.00 dollars and checks that each threshold fires. Its projection exercise forecasts the month from the trailing 7-day average and alerts when the forecast exceeds the budget by more than 20 percent. Both belong in the test suite, because a circuit breaker that was never tripped on purpose is a hope.

### Where it runs

At the gateway, where every call passes. A control that lives in one application misses the application that has the bug.

## Follow-ups

- **Level 2:** Why three thresholds and not one hard stop? Expected: the alert gives people time, the throttle buys more time at lower quality, and the stop protects the budget. One hard stop surprises users with no warning.
- **Level 3:** What changes for users during the throttle step? Expected: quality, because every request goes to the cheapest model. The service stays up while the spend slows.
- **Level 3:** Why is the kill switch relative to the tenant's history? Expected: tenants differ by orders of magnitude. A z-score catches a jump for a small tenant and ignores a normal day for a large one.
- **Level 4:** The retry bug spent the budget in two days. Which control fires first? Expected: the daily spend cap or the z-score kill switch fires on the first day. The monthly ladder would only have warned at 70 percent.

## Wrong answers

- "Set a hard limit at the provider and stop there." The provider limit stops every tenant at once with no warning. The ladder degrades first and isolates the tenant.
- "An alert to the team channel is enough." The incident is a bug at night. The throttle and the stop act without a person.
- "Check the budget nightly." A retry loop spends a day's budget in minutes. The tracker has to run on every call.

## Taught in

The [caching and cost lesson](../../../phases/11-llm-engineering/11-caching-cost/) sets the three budget thresholds, and the [FinOps lesson](../../../phases/17-infrastructure-and-production/27-finops-llms/) adds the per-tenant enforcement ladder.
