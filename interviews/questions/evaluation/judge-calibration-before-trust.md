---
id: judge-calibration-before-trust
title: Before a judge score can gate a release
card: evaluation
kind: concept
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [ml-depth, design-review]
tags: [llm-as-judge, calibration, spearman, rubric]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks]
manuals: []
practice: []
cheatsheet: [llm-evaluation, generative-evaluation]
related: [evaluation/pick-the-eval-method]
updated: 2026-11-03
---

You wrote a rubric, and a judge model now scores faithfulness for your retrieval system. The dashboard shows a high mean, and the team wants to use it as the release gate from Monday. What has to happen before this number can block or approve a release?

## Short answer

Calibrate the judge against people first. Hand label about 100 cases, score them with the judge, and compute the Spearman correlation between the two rankings. Below 0.7 the rubric needs work and the number is noise. Then freeze the judge model and version, and read the bottom scores as well as the mean.

## Full answer

### Why a raw judge score lies

A judge fails in three silent ways. It carries biases: it prefers longer answers, answers from its own model family and answers that match the prompt style. It can return bad JSON, which becomes a missing score that drops out of the aggregate and raises the mean. It drifts: a new judge version changes every metric at once.

### The calibration run

1. Label at least 50 cases by hand; the lesson uses 100. Cover the bottom of the distribution, not only easy cases.
2. Score the same cases with the judge.
3. Plot judge against human and compute the Spearman rank correlation.
4. A correlation below 0.7 means the rubric needs work. A judge at 0.3 is noise.

Use a judge from a different model family than the generator. A model that grades its own family inflates the score by about 10 to 20 percent.

### After the run

- Freeze the judge model and version. When you upgrade, run the old and the new judge on the same baseline before you compare anything.
- Inspect the bottom quantile. A mean of 0.85 can hide a 5 percent slice of catastrophic failures.
- Version the eval set and tag it with every change, so that a score this month means the same as a score last month.

## Follow-ups

- **Level 2:** Why Spearman and not the mean difference between judge and human scores? Expected: Spearman compares rankings, so a judge that is harsh but orders the cases the same way still passes.
- **Level 2:** What is the smallest hand labeled set the lesson accepts? Expected: it refuses a judge tested on fewer than 50 human labeled examples.
- **Level 3:** The judge is the same model that writes the answers. What will the calibration run probably show? Expected: inflated scores by about 10 to 20 percent; switch the judge to another model family.
- **Level 3:** The correlation passes, but the bottom decile holds confident wrong scores. Do you ship? Expected: no; the mean correlation can hide catastrophic failures, so inspect the lowest 10 percent before the number gates anything.

## Wrong answers

- "The rubric is clear, so the judge is right." Length and family biases survive a clear rubric; only a correlation against human labels shows their size.
- "It agrees with our old metric, so it is calibrated." The old metric may share the bias; calibrate against people.
- "Calibrate once and keep upgrading the judge." Each judge version changes every score; freeze the version or rerun the baseline in parallel.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) gives the calibration recipe and the three silent failures of a judge.
