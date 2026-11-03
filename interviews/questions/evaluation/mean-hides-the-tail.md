---
id: mean-hides-the-tail
title: The mean is green and users see failures
card: evaluation
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, ml-depth]
tags: [aggregation, pass-rate, bottom-quantile, faithfulness]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, phases/10-llms-from-scratch/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust]
updated: 2026-11-03
---

A faithfulness dashboard reports a mean of 0.85 over a thousand cases, above the 0.8 release threshold. Support tickets say the assistant invents policy details in some answers. The eval owner says the metric is green. Where do you look, and what do you change in the report?

## Short answer

A mean hides the tail. A mean of 0.85 is consistent with a 5 percent slice of catastrophic failures, and that slice is what becomes tickets. Sort the cases by score and read the lowest 10 percent. Then add a pass rate at a threshold and a bottom quantile alert to the report, next to the mean.

## Full answer

### Why the dashboard is green

Most cases score high while a small slice scores near zero. The average barely moves, because the slice is small. The users in that slice get an invented policy, and no average tells them it was rare.

### What to report

- **Pass rate.** The fraction of cases above a threshold. It measures reliability, which is what users feel, so it is more actionable than the mean.
- **Bottom quantile.** The lesson refuses aggregate only reporting without the lowest 10 percent surfaced. Read those cases by hand every run.
- **Per-category scores.** If the tail comes from one category, the fix is local and the gate should watch that category.

### How to debug it

1. Pull the lowest scoring cases and read them. Confirm they match the tickets.
2. Check how missing scores were counted. A judge that returned bad JSON produces a missing score, and dropping missing scores raises the mean.
3. Check that the judge was calibrated at the low end. A hand labeled set made of easy cases says nothing about the tail.

## Follow-ups

- **Level 2:** Why does the lesson prefer the share of cases above a cutoff to the mean? Expected: it counts how many cases are good enough, so it measures reliability.
- **Level 2:** The lowest cases all come from one category. What changes? Expected: the fix is local; report per-category scores and gate on the weakest category, not the aggregate.
- **Level 3:** Missing scores from parse failures were dropped before averaging. What did that do? Expected: it raised the mean, because the worst outputs often fail to parse; count them as failures or report them separately.
- **Level 3:** Which alert do you add to the release gate? Expected: a floor on the lowest 10 percent and a pass rate threshold, both next to the mean.

## Wrong answers

- "The mean passed, so the release passed." A mean of 0.85 often hides a 5 percent catastrophic slice; the gate needs the tail.
- "Raise the mean threshold to 0.9." A higher mean threshold still hides a small slice of zeros; add a distribution measure.
- "The judge is noisy at the bottom, so ignore those cases." That is where the failures live; calibrate the judge on low scoring cases too.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) lists the raw aggregate pitfall and the bottom quantile rule, and the [evaluation lesson](../../../phases/10-llms-from-scratch/10-evaluation/) defines pass rate as the more actionable summary.
