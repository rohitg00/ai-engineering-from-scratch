---
id: stated-confidence-ece
title: The model says 0.9 and is right six times in ten
card: safety
kind: estimate
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, screen]
tags: [calibration, ece, refusal, stated-confidence]
minutes: 7
lessons: [phases/19-capstone-projects/84-refusal-evaluation]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/two-refusal-metrics]
updated: 2026-11-03
---

Your refusal evaluation asks the model to state a confidence with each answer. In the bin where the model says 0.9, it is right on 60 percent of the prompts. Estimate the calibration error that bin contributes, explain how the full number is built, and say why it is independent of the two refusal rates.

## Short answer

The gap in that bin is about 0.3: a stated 0.9 against an observed 60 percent. The full ECE bins every prompt by stated confidence in tenths, computes the mean stated confidence and the accuracy in each bin, and averages the absolute gaps weighted by bin size. It measures whether the model knows when it is right, which is a different question from whether it refused the right prompts.

## Full answer

### Where the confidence comes from

The harness parses a confidence token from the model output. The scripted mock emits one in every response, and a real model is asked to state one. The harness consumes the number and does not care how it was produced.

### Building the number

1. Put each prompt in a bin by its stated confidence, in tenths.
2. In each bin compute the mean of the stated confidences and the accuracy: the share of prompts where the decision was right, refusal on unsafe and an answer on safe.
3. Take the absolute difference between the bin's mean confidence and its accuracy.
4. Average the differences weighted by the number of prompts in each bin.

A bin that says 0.9 and scores 60 percent contributes a gap of about 0.3 times its share of the prompts.

### Why it is independent

Under refusal and over refusal describe the decision. Calibration describes the match between the model's stated certainty and its hit rate. A model can decide perfectly and be badly calibrated, or decide badly while its confidence tracks its accuracy. The report shows the three numbers side by side for that reason.

### What to do with it

Overconfident bins are where to look first. When you tune a policy, a reliability curve per policy, confidence against accuracy per bin, shows which bins moved. With a few dozen prompts the bins are thin, so publish the bin counts and treat the value as a smoke test until the set grows.

## Follow-ups

- **Level 2:** Why weight the gaps by bin size? Expected: a bin with two prompts should not count as much as a bin with twenty; the weight makes the number reflect where the predictions are.
- **Level 2:** The model refuses every unsafe prompt and answers every safe one, and its calibration error is large. Is that possible? Expected: yes; calibration measures the match between stated confidence and accuracy, not the decision.
- **Level 3:** The prompt set is small. How much do you trust a per bin number? Expected: little; most bins hold a handful of prompts, so report the counts and treat the value as a smoke test until the set grows.
- **Level 3:** Which plot replaces the single number when you tune a policy? Expected: a reliability curve per policy, confidence against accuracy per bin, which shows the overconfident bins.

## Wrong answers

- "A calibration error of 0.3 means the model is wrong 30 percent of the time." It means the stated confidence and the observed accuracy differ by about 0.3 in that bin; the error rate is a separate number.
- "A well calibrated model refuses correctly." Calibration says the model knows when it is right; it can be calibrated and still answer unsafe prompts.
- "Ask for confidence and the number is meaningful." A stated confidence is a claim; the evaluation exists to check it against accuracy.

## Taught in

The [refusal evaluation capstone](../../../phases/19-capstone-projects/84-refusal-evaluation/) computes expected calibration error from stated confidence next to the refusal rates.
