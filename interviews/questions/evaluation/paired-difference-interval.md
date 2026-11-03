---
id: paired-difference-interval
title: Three models, fifty tasks, one leaderboard
card: evaluation
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [leaderboard, bootstrap, win-rate, paired-comparison]
minutes: 10
lessons: [phases/19-capstone-projects/74-leaderboard-aggregation, phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/wilson-or-bootstrap]
updated: 2026-11-03
---

You run three candidate models on the same fifty tasks and must publish a leaderboard with a winner. The means are 0.78, 0.75 and 0.10. The second team says their model is tied with the first. Design the aggregation and the statistics that settle it.

## Short answer

Report a mean with a bootstrap interval, a win rate, and a paired interval on the difference for each pair of models. Resample the tasks with replacement to get the interval on each mean. For the tie claim, bootstrap the per task difference between the first two models; if that interval includes zero, the leaderboard shows them as tied.

## Full answer

### The input

One record per model and task: model id, task id, metric name, a score in the unit range, and a category. The aggregator refuses any score outside the unit range, because a task that reports 0 to 100 would silently dominate the mean. Normalization belongs in the metric, upstream.

### Two rankings

- **Mean score** is the headline. It is sensitive to outliers and to task imbalance.
- **Win rate** counts the tasks where the model has the best score; a tie gives every tied model a full win. It is less sensitive to outliers and to scale, and it loses magnitude information.

Report both. Rank by mean by default and keep the win rate column.

### The intervals

Bootstrap over task ids: resample the fifty tasks with replacement, compute the mean, repeat, and take the percentile interval at the 0.05 level. The low level helpers default to 1000 resamples and the public aggregators to 500. For a pair of models, bootstrap the per task difference and read whether the interval excludes zero. That is the test for the tie claim, and it is paired because both models ran the same tasks.

### Categories and rendering

If each task carries a category, report a per category mean. A model that is good overall and weak on code shows up there and nowhere else. Render a table sorted by mean with rank, model, mean, interval to two decimals, win rate and task count.

### What this leaves out

Task weighting; every task counts the same. And independence: ten arithmetic items that share one error pattern are not fifty independent samples. A hierarchical bootstrap that resamples task families, then tasks, is the follow up.

## Follow-ups

- **Level 3:** Why bootstrap over tasks and not over predictions within a task? Expected: the unit of replication is the task; resampling within a task understates the variance across tasks.
- **Level 3:** When does win rate rank differently from the mean? Expected: when one model wins many tasks by a little and loses a few by a lot; the mean punishes the big losses, the win rate counts the wins.
- **Level 4:** Tasks come in families that share error patterns. What breaks? Expected: the tasks are not independent, so the interval is too narrow; resample families first, then tasks.
- **Level 4:** One task's metric returns 0 to 100 instead of 0 to 1. What should the aggregator do? Expected: refuse the run; a silent rescale would hide the bug, and the metric must return a fraction.

## Wrong answers

- "Two means with overlapping intervals are tied." The paired difference is the test; separate intervals can overlap while the difference excludes zero.
- "Rank by win rate, it is robust." It loses magnitude; a model that wins every task by a hair and loses one badly looks perfect. Report both.
- "Weight the tasks by importance now." The capstone counts every task the same; add weights only with a documented reason and keep the unweighted table.

## Taught in

The [leaderboard aggregation capstone](../../../phases/19-capstone-projects/74-leaderboard-aggregation/) builds the mean, the win rate and the bootstrap intervals, and the [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) explains why a paired comparison decides.
