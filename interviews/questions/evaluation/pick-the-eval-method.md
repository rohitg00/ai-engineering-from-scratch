---
id: pick-the-eval-method
title: Overlap metric, judge model or human review
card: evaluation
kind: tradeoff
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [llm-as-judge, rouge, human-eval, cost]
minutes: 6
lessons: [phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust]
updated: 2026-11-03
---

You can score a summarization feature in three ways: n-gram overlap against a reference, a strong model that grades with a rubric, or human experts. The team has one afternoon and a small budget. How do you decide which to use, and for what?

## Short answer

Use all three, each for a different job. Overlap metrics are free and instant but agree with people only 40 to 60 percent of the time, so they serve as a baseline and a smoke test. A judge model costs a few dollars per thousand cases and agrees 82 to 88 percent with people on a well anchored rubric, so it is the default scorer. People are the ground truth, so spend them on calibrating the judge and on edge cases, not on every commit.

## Full answer

### The trade

| Method | Speed | Cost per thousand | Agreement with people | Use |
|---|---|---|---|---|
| BLEU or ROUGE | under a second | nothing | 40 to 60 percent | baselines, smoke tests |
| Embedding similarity | about 30 seconds | nothing | 55 to 70 percent | screening |
| Judge model, small tier | about 3 minutes | about 8 dollars | 82 to 86 percent | default CI judge |
| Judge model, large tier | about 5 minutes | about 25 dollars | 85 to 88 percent | high stakes, safety |
| Human expert | about 2 hours | about 500 dollars | ground truth | calibration, policy |

### Why each one stays

Overlap metrics miss meaning. Two answers with no shared words can both be right, and a high ROUGE answer can be wrong in context. They stay because they cost nothing, run in seconds and do not drift when a judge model changes.

The judge captures relevance, correctness, helpfulness and safety. It stays the workhorse because it scales. It needs a rubric with anchored levels and a calibration run against human labels before its number means anything.

Human review is slow and expensive. It stays because it is the only ground truth. Reserve it for calibrating the automated scores and for the cases the judge cannot settle.

### For the afternoon

Run the overlap metric on everything to catch gross breakage. Run the judge on the golden set with the four criteria. Have two people label a small slice and compare it with the judge before anyone reads the mean.

## Follow-ups

- **Level 1:** What does ROUGE measure? Expected: recall of reference n-grams, built for summarization.
- **Level 2:** Why keep the overlap metric once you have a judge? Expected: it is free and fast, it catches gross regressions in seconds, and it does not move when the judge model changes.
- **Level 2:** When is a judge not enough? Expected: high stakes or policy decisions, and any time the judge has not been calibrated against human labels on this task.
- **Level 3:** The lesson says the judge must be at least as capable as the model it grades. Why? Expected: a weak judge gives noisy, inconsistent scores and cannot see the errors a stronger model makes.

## Wrong answers

- "People are the gold standard, so grade everything by hand." Human review takes hours and costs about 500 dollars per thousand cases, so it cannot run on every change.
- "Overlap metrics are useless for generation." They catch gross regressions and cost nothing; they only miss meaning.
- "Pick one metric and optimize it." Optimizing only correctness yields terse answers that nobody can use; score several criteria.

## Taught in

The [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) compares the three methods by speed, cost and agreement with people.
