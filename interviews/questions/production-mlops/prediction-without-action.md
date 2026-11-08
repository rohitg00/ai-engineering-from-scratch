---
id: prediction-without-action
title: What the system does with a predicted outage
card: production-mlops
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [ai-sre, prediction, incident-response, policy]
minutes: 15
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: []
practice: []
cheatsheet: [sre-for-ai]
related: [production-mlops/narrow-auto-remediation, production-mlops/two-models-disagree]
updated: 2026-11-03
---

A model trained on your logs, GPU temperatures and error patterns predicts most outages ten to fifteen minutes before they happen. The team wants to ship it as a dashboard panel. Design what the system does with a prediction, and defend the design.

## Short answer

A prediction with no action is a dashboard, and nobody watches a dashboard at three in the morning. Write a policy per prediction class: page the on-call, drain the suspect node or pool before it fails, or scale within approved bounds, and record every prediction with its outcome. Start with the page, measure the precision on live incidents, and promote a class to an automatic drain only when its false alarm rate is acceptable and a person has approved that drain as a pre-approved action in the runbook.

## Full answer

### The result and its limit

The lesson cites a research result: a model trained on past log lines, GPU temperature readings and API error patterns predicted 89 percent of outages 10 to 15 minutes early on its test set. The lesson's reality check follows at once. Predictions without actuation are dashboards. The operational question is what you do when the prediction fires.

### The design

1. **Classify the prediction.** Which failure is coming: a memory exhaustion, a thermal slowdown, a provider error burst. Attach the confidence.
2. **Map each class to an action.** The lesson's safe set is narrow: restart a pod, revert a deploy, scale within pre-approved bounds. A drain is not on that list, so it needs approval before it runs on its own. Drain the pod from the load balancer and restart it before it falls over. Scale the pool within approved bounds. Page a person with the prediction and the evidence.
3. **Fit the action into the lead time.** A drain plus a replacement must complete inside the ten to fifteen minutes, so the replacement has to be warm already. A cold start of a large model takes minutes and can eat the whole window.
4. **Record outcomes.** Every prediction, its class, the action taken and whether the outage happened. Precision and recall per class come from this log, not from the paper.
5. **Guard the blast radius.** Never run two automatic drains in the same pool at once, and never drain under a load spike without a warm spare.

### Why page first

A page costs sleep. A false drain costs capacity for the drain time. A false scale-up costs money. Until the precision per class is measured in production, the cheapest wrong action is the page. Promote a class to automatic action when its record justifies it, the same ladder the lesson uses for remediation.

## Follow-ups

- **Level 3:** What does a false alarm cost under each policy? Expected: a page costs sleep, a drain costs capacity for the drain time, and a scale-up costs money. Pick the policy per class from that cost against the cost of the outage.
- **Level 4:** The lead time is ten minutes and a replacement replica takes longer to warm. What changes? Expected: keep a warm spare or act earlier on a weaker signal. A drain with no warm replacement moves the outage instead of preventing it.
- **Level 4:** How do you know the predictor still works after the service changes? Expected: track precision and recall per class on live incidents, and retrain when the input distribution shifts.

## Wrong answers

- "Ship the panel and let on-call decide." At night nobody watches a panel. The lesson's point is that a prediction without an action is a dashboard.
- "Automate the drain for every prediction from day one." A false alarm then costs capacity, and nothing has measured the false alarm rate on your traffic.
- "The research number means we will prevent most outages." The number was on a test set. Your precision in production is unknown until you measure it.

## Taught in

The [SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/) reports the early-detection result and asks what the system does when it predicts.
