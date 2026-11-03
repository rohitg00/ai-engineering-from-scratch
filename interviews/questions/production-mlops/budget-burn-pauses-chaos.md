---
id: budget-burn-pauses-chaos
title: Keep a production chaos experiment from becoming an incident
card: production-mlops
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [chaos-engineering, error-budget, blast-radius, alerting]
minutes: 18
lessons: [phases/17-infrastructure-and-production/24-chaos-engineering-llm]
manuals: []
practice: []
cheatsheet: [sre-for-ai]
related: [production-mlops/chaos-before-you-start, production-mlops/retries-that-amplify]
updated: 2026-11-03
---

You run a chaos experiment in production. One model provider returns rate-limit errors for part of the fleet, so that you can watch the fallback. Alerts start to fire while it runs. Design the safety plane that keeps this from turning into an incident, and explain how on-call tells an experiment failure from a natural one.

## Short answer

Three guards sit in the safety plane: a burn-rate alert that pauses the experiment when the daily error-budget burn passes twice the expected rate, suppression windows that silence the non-experiment alerts inside the blast radius, and a tag on the trace id of every error that the experiment causes. On-call reads the tag. An untagged error inside the window is natural and gets the normal response.

## Full answer

### The planes

The lesson splits the system into a control plane that schedules the experiment, a target plane of services, pods and data stores, a safety plane with the kill switch, suppression windows, blast-radius limits and error-budget gates, and an observability plane that correlates every error with a trace id. The findings feed back into the SLO, the runbooks and the code.

### The three guards

1. **Burn-rate pause.** The experiment is allowed to spend error budget, because that is what a controlled failure does. The gate fires when the daily burn exceeds 2x the expected rate, and it pauses the experiment on its own.
2. **Suppression windows.** Alerts that the experiment is designed to trigger are silenced for the blast radius and the duration. Nothing outside the radius is silenced.
3. **Trace-id correlation.** Every experiment-induced error carries a tag, so that on-call can separate it from natural failures without a conversation.

The kill switch is a fourth, manual control. It stops the experiment at once and belongs to on-call, not to the scheduler.

### How on-call reads an alert during the window

- A tagged error inside the blast radius is the experiment working. It is logged, not paged.
- An untagged error inside the window is natural. It takes the normal response.
- An error outside the blast radius is natural, because the experiment did not touch it.
- If the burn continues after the pause, the cause is natural, or the experiment broke something that does not recover alone. Run the incident response and roll back the last change.

### What this experiment should teach

The lesson notes that most teams discover their fallback was never fully tested. Record the time from the first rate-limit error to the first successful fallback, and compare it with the SLA. Record whether the gateway's retries amplified the load before the fallback engaged.

### Size the blast radius

Choose a share of the fleet small enough that the fallback capacity on the other providers covers it, and write that share into the experiment definition. A larger share tests more and risks a real outage when the fallback is slower than you believed.

## Follow-ups

- **Level 3:** Why gate at twice the expected burn and not at any burn? Expected: an experiment is meant to spend some budget. The gate catches the case where it spends far more than planned.
- **Level 4:** The burn keeps rising after the pause. What does that tell you? Expected: the cause is natural, or the experiment broke something that does not recover on its own. Run the incident response and roll back the last change.
- **Level 4:** How do you pick the blast radius for a provider outage experiment? Expected: a share small enough that the fallback capacity covers it, written into the experiment definition and reviewed with on-call.

## Wrong answers

- "Silence all alerts during the experiment." A natural incident in the same window goes unseen. Silence only the blast radius, and keep tagged errors visible.
- "Run it in staging, so no safety plane is needed." Staging cannot show the fallback under real traffic. The safety plane is what makes production acceptable.
- "The burn-rate alert is the kill switch." The alert pauses the experiment. The kill switch stops it at once, and it should be a separate manual control.

## Taught in

The [chaos engineering lesson](../../../phases/17-infrastructure-and-production/24-chaos-engineering-llm/) defines the four planes, the burn-rate pause, suppression windows and trace-id correlation.
