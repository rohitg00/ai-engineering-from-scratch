---
id: two-refusal-metrics
title: It refuses everything harmful, and the homework
card: safety
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [refusal, over-refusal, under-refusal, safety-eval]
minutes: 6
lessons: [phases/19-capstone-projects/84-refusal-evaluation]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/stated-confidence-ece, safety/safety-eval-missing-pieces]
updated: 2026-11-03
---

After a safety pass, the assistant refuses every prompt in the harmful set. The safety lead calls it a success. A product manager says that chemistry homework now gets refused too. Which numbers settle this, and how do you compute them?

## Short answer

You need two metrics, not one. The under refusal rate is the share of unsafe prompts the model answered, and the over refusal rate is the share of safe prompts it refused. Treat the assistant as a binary classifier on prompt safety: label a prompt set safe or unsafe, detect refusals in the outputs, and report both rates with accuracy and a per category breakdown.

## Full answer

### Four objects

1. A labeled prompt set. The capstone uses 25 unsafe prompts drawn from the taxonomy by id and 30 safe everyday prompts, with no overlap with the detector's benign set so the two evaluations stay independent.
2. A model under test. The capstone uses a scripted mock with three policies: strict, over cautious and leaky. The last two are bugs the framework must detect.
3. A refusal classifier on the output: a regex over phrases such as "I cannot", "I will not" and "as a responsible".
4. An aggregator.

### The numbers

- **Under refusal**: answered, on a prompt labeled unsafe.
- **Over refusal**: refused, on a prompt labeled safe.
- **Accuracy**: unsafe prompts correctly refused plus safe prompts correctly answered, over all prompts.
- **Calibration**: when the model states a confidence, bin the prompts by it and compare each bin's confidence with its accuracy. A model that says 0.9 and is right 60 percent of the time has a gap of about 0.3 in that bin.
- **Per category**: under refusal joined against the six taxonomy categories, so you can see that the model handles instruction override and slips on multi turn ramp.

### Reading the two sides

A model that refuses everything has a perfect under refusal rate and a terrible over refusal rate. Every system prompt change moves both rates at once, so the report shows them side by side and the strict policy's numbers are the regression baseline.

## Follow-ups

- **Level 1:** What does accuracy mean in this evaluation? Expected: unsafe prompts refused plus safe prompts answered, divided by all prompts.
- **Level 2:** Why run the evaluator against a scripted mock model at all? Expected: a real model moves with every prompt and temperature change; a scripted policy moves the metrics for a known reason, so the framework itself can be tested.
- **Level 2:** Why must the safe prompts here differ from the benign prompts used to test the detector? Expected: so the refusal evaluation and the detector evaluation stay independent and one does not tune the other.
- **Level 3:** Why is a regex an acceptable refusal classifier here? Expected: it is auditable and deterministic; its misses are a known limit, and a model classifier can replace it later without changing the metric definitions.

## Wrong answers

- "Refusal rate on harmful prompts is the safety metric." It is half; a model that refuses everything scores perfectly on it.
- "Over refusal is a product problem, not a safety problem." Both are bugs in the same decision boundary, and they move together with every change.
- "Accuracy alone is enough." It hides which side failed; report both rates and the per category breakdown.

## Taught in

The [refusal evaluation capstone](../../../phases/19-capstone-projects/84-refusal-evaluation/) defines under refusal, over refusal, accuracy, calibration and the breakdown by attack category.
