---
id: judge-upgrade-moved-every-score
title: Every metric moved and the product did not
card: evaluation
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [debugging, design-review]
tags: [llm-as-judge, drift, versioning, baseline]
minutes: 7
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust]
updated: 2026-11-03
---

Overnight every metric on the eval dashboard moved by several points, up for some criteria and down for others, with no prompt change and no model change in the product. The last merged change switched the judge to the newest version of its model. What happened, and how should such a change be made?

## Short answer

The judge is part of the measurement, so a new judge version changes every metric at once while the product stands still. Freeze the judge model and version in the pipeline. When you upgrade, run the old and the new judge on the same baseline in parallel, calibrate the new judge against the human labeled set, and reset the baseline before you compare anything new.

## Full answer

### Why everything moved

A judge score is a function of the output and of the judge. Change the judge and every stored score is in a different unit. The lesson lists judge version drift as one of the three silent failures and asks you to flag any pipeline where a judge upgrade lands without a parallel baseline eval.

### The upgrade protocol

1. Pin the judge model and version, and record both with every run.
2. Before a switch, score a frozen baseline set with the old and the new judge.
3. Calibrate the new judge: Spearman correlation with the hand labeled set of 0.7 or more.
4. If the new judge calibrates better, adopt it and rescore the stored baselines so that history and new runs share one judge.
5. Mark the switch on every chart.

### Other things that move every score

An edit to the eval set without a version tag. A change in how missing scores are counted. A run that dropped some tasks. Tag the dataset with every change and record the task count.

## Follow-ups

- **Level 2:** What else can move every score without a product change? Expected: an eval set edit without a version tag, or a change in how missing scores are counted.
- **Level 2:** How do you tell a judge change from a product regression next time? Expected: the run metadata records the judge model and version, so a diff of the metadata answers it.
- **Level 3:** The new judge correlates better with the human labels. Do you adopt it? Expected: yes, but rescore the stored baseline with it first so that old and new numbers share one judge.
- **Level 3:** You must keep a trendline across the switch. How? Expected: score a fixed frozen set with both judges, publish the offset per criterion, and mark the switch on the chart.

## Wrong answers

- "Newer judge, higher scores, ship it." The product did not change; the number did. A judge change needs a parallel baseline.
- "Follow the newest judge version automatically." Automatic upgrades make every trendline meaningless; pin the version.
- "A minor version does not need recalibration." Any version change can change the scores; rerun the correlation.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) names drift over judge versions and requires a side by side run on a frozen baseline before any upgrade lands.
