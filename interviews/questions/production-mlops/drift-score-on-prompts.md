---
id: drift-score-on-prompts
title: Detect that the questions changed when the evals did not
card: production-mlops
kind: concept
level: 2
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [ml-breadth, system-design]
tags: [drift, psi, embeddings, monitoring]
minutes: 8
lessons: [phases/19-capstone-projects/11-llm-observability-dashboard]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/five-minute-detection, production-mlops/evals-or-ab-test]
updated: 2026-11-03
---

Your eval scores have been flat all year. A product owner tells you that what users ask has changed a lot since spring. How do you detect that change from telemetry, and what do you do with the result?

## Short answer

Embed the prompts, pool them per week, and compare the week with a trailing baseline using a population stability index or a KL divergence. A rising score means the input distribution moved, even when the scores on your fixed eval set did not. Alert above a threshold, then sample and label prompts from the new distribution, refresh the eval set, and recheck routing and prompts against it.

## Full answer

### Why the evals cannot see it

An eval runs the model on a fixed, labeled set. It measures the model on last spring's questions. When the questions change, the eval set does not, so the score stays flat while the product quietly serves a different population.

### The detector

The capstone runs a weekly job. It pools the prompt embeddings of the week and computes the PSI against the trailing 4-week baseline. The key terms table gives the usual reading: a PSI above 0.2 signals a meaningful shift. The sample output shows a quiet week at 0.08, below that threshold. The same job can use a KL divergence on the same embeddings. Track the eval score trend next to it, so that both views sit on one page.

### Per application, not only global

A global score averages the drift away. The capstone's exercise computes the PSI per application id, which shows which surface moved. A support bot and a code assistant rarely drift together.

### What to do with a real shift

1. Sample prompts from the new distribution, label them, and refresh the eval set.
2. Rerun the evals on the refreshed set. A flat score on the old set says nothing about the new one.
3. Recheck anything trained or tuned on the old distribution: a routing classifier, the prompt templates, the cache thresholds.

### Where it lives

In the observability plane: spans land in the span store, the weekly job reads them, writes a metric, and the alert chain picks it up.

## Follow-ups

- **Level 2:** What is the difference between a PSI on prompts and a falling eval score? Expected: the PSI measures the inputs, the eval measures the model on fixed inputs, and the first can move while the second stays flat.
- **Level 2:** Why run the detector per application id? Expected: a global score averages the drift away, and the per-application view shows which surface moved.
- **Level 3:** What goes wrong with a one-week baseline? Expected: weekly seasonality looks like drift, and the baseline moves along with the inputs it should measure.
- **Level 3:** The PSI crossed the threshold after a marketing campaign. Is that a problem? Expected: it is a real shift in the inputs. The question is whether quality held on them, so sample, label and evaluate.

## Wrong answers

- "Flat eval scores mean no drift." The eval set is fixed, so it cannot see the inputs change.
- "Compare the raw prompt strings." Wording varies on every request. Embeddings capture the topic distribution.
- "Alert on any score above zero." Small values are noise. The capstone's threshold is 0.2.

## Taught in

The [observability dashboard capstone](../../../phases/19-capstone-projects/11-llm-observability-dashboard/) runs the weekly PSI job on prompt embeddings and sets the alert chain.
