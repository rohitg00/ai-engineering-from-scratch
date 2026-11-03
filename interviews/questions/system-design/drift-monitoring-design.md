---
id: drift-monitoring-design
title: Design monitoring for a payment risk model
card: system-design
kind: design
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design]
tags: [monitoring, drift, psi, alerting]
minutes: 15
lessons: [phases/02-ml-fundamentals/20-model-monitoring-and-drift]
manuals: []
practice: []
cheatsheet: [ml-system-design, ml-evaluation-metrics]
related: [system-design/concept-drift-blind-spot, system-design/fraud-check-100ms]
updated: 2026-11-03
---

A payment risk model scores every transaction. Labels arrive weeks later as chargebacks. Design the monitoring: what you watch, how you compare windows, which statistics you compute, and how you keep the alert rate low enough that people read the alerts.

## Short answer

Monitor four layers: system health, input distributions, prediction distributions, and outcomes once labels arrive. Compare a fixed reference window with sliding current windows, with the Population Stability Index and the two-sample KS statistic for numeric features and a chi-square test with Cramér's V for categorical ones. Alert only when a corrected p-value and an effect size both pass and the condition persists for consecutive windows, and send warnings to a dashboard rather than to a person.

## Full answer

### Four layers

| Layer | Signals | Available | Question |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput | At once | Does the service answer? |
| Inputs | Feature distributions, missing rates, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

Only the last layer measures correctness and it arrives late, so the first three are the early warning.

### Windows

The reference is the training data or a hand-checked production period, fixed until retraining. The current window is the last N events or the last T hours, sliding by a step smaller than its size. A small window reacts quickly and scores noise as drift; a large window is stable but late. Seasonality breaks naive windows, so the reference covers a full cycle or each window is compared with the same period of an earlier cycle. The lesson's demo uses windows of 500 events that move by 250, with labels 500 events late.

### Statistics

- PSI over ten reference-decile bins, with shares clipped to a small value so no bin is empty; conventional bands read below 0.1 as stable and above 0.25 as a significant shift, with the caveat that PSI grows with bins and shrinks with sample size.
- KS statistic D as the effect size for numeric features, with its p-value from the effective sample size; with large samples the p-value alone flags gaps nobody cares about.
- Chi-square with Cramér's V for categorical features, which also reacts to a category that appears only in the current window. With few events in a cell the p-value is not reliable, so pool rare categories into one bin before the test.

### Alert policy

With 50 features checked every hour at an alpha of 0.05, about 60 false alarms a day arrive when nothing changed. Four rules keep the rate useful: correct for multiple tests, so a family alpha of 0.01 over two tests gives 0.005 each; require an effect size; require persistence over consecutive drift windows, two in the demo; and separate dashboard warnings from alerts to a person.

### What retraining does

Covariate drift with stable accuracy often needs no action. Covariate drift into regions with little data calls for retraining on recent data. Prior drift calls for recalibration or a new threshold. Concept drift needs new labels first, because retraining on old labels teaches the old concept again.

## Follow-ups

- **Level 2:** Why fix the reference window instead of sliding it too? Expected: a sliding reference follows the drift and hides it; the reference changes only at retraining.
- **Level 2:** A clean window shows a tiny chi-square p-value. Why is it a warning and not an alert? Expected: the effect size is below threshold, so the policy logs a warning; the p-value alone is not enough.
- **Level 3:** Labels arrive 500 events late. How does the outcome monitor handle that? Expected: it joins labels as they arrive and computes metrics on the labeled part, always looking that far into the past.
- **Level 3:** Which drift stays invisible to this whole design except the last layer? Expected: concept drift, where the inputs do not change and only outcomes reveal the new relation.

## Wrong answers

- "Alert on any p-value below 0.05." With many features and hourly checks that is dozens of false alarms a day and people stop reading.
- "Watch accuracy; it is the only metric that matters." Accuracy arrives after the label delay; input and prediction monitors give the early warning.
- "Retrain on a schedule and skip monitoring." A schedule retrains when nothing changed and waits when something did.

## Taught in

The [model monitoring lesson](../../../phases/02-ml-fundamentals/20-model-monitoring-and-drift/) gives the four layers, the windows, the three statistics and the alert policy.
