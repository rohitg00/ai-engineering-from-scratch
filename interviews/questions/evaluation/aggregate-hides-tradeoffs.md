---
id: aggregate-hides-tradeoffs
title: The leaderboard winner is worst on code
card: evaluation
kind: tradeoff
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [design-review, system-design]
tags: [aggregation, weights, per-category, leaderboard]
minutes: 10
lessons: [phases/19-capstone-projects/41-eval-pipeline, phases/19-capstone-projects/74-leaderboard-aggregation, phases/05-nlp-foundations-to-advanced/28-long-context-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/paired-difference-interval, evaluation/eval-pipeline-take-home]
updated: 2026-11-03
---

A leaderboard ranks your candidate models by one aggregate score, and the top model wins by a small margin. A colleague on the code team says that the top model is the worst of the three on their work. Both read the same report. How is this possible, what does the aggregate hide, and how do you publish so that both readers are served?

## Short answer

The aggregate is a weighted mean, so a model can win overall and lose in one category, and a small margin can sit inside the interval on the mean. Publish the per category means next to the aggregate, with intervals, and print the weights. If the leaderboard also mixes scales, a task with a wider range dominates the mean without anyone noticing.

## Full answer

### Where the aggregate comes from

The eval pipeline normalizes each eval into the unit range and takes a weighted mean; the default mix there is 0.2 for perplexity, 0.3 for exact match, 0.3 for token F1 and 0.2 for the judge. The aggregator in the leaderboard lesson takes the plain mean over tasks. In both cases the headline is one weighting of several numbers, and a different weighting is a different winner.

### What it hides

- **Category weakness.** The per category column, such as math, reasoning, code and safety, is the only place where a model that is strong overall and weak on code shows up.
- **Task imbalance and outliers.** The mean is sensitive to both; the win rate is less sensitive and loses magnitude.
- **Scale leakage.** A task that scores from 0 to 100 next to tasks in the unit range dominates the mean, so the aggregator refuses scores outside the unit range.
- **The margin.** A small gap between the top two means nothing until the paired bootstrap of their per task difference excludes zero.

The long context lesson states the same rule from another angle: report per category accuracy, because aggregate scores hide large task level differences.

### How to publish

Three layers on one page. The aggregate at the top with its weights printed. Below it, every per eval or per category number with intervals and the win rate. Below that, the per example records a reviewer needs to chase a regression. Add the paired difference interval for the top two models, and if a category matters to the product, a block rule on that category.

## Follow-ups

- **Level 3:** The code team wants the code category to count double. Do you change the headline? Expected: no; keep the unweighted table and, if agreed, add a second weighted view with its weights printed, as the capstone leaves weighting an explicit hook.
- **Level 3:** The top two means differ by less than their intervals. What does the leaderboard show? Expected: the paired bootstrap of the per task difference; if it includes zero the two are tied and the rank order is a coin flip.
- **Level 4:** Which single change to the report would have stopped this argument? Expected: per category means with intervals under the headline, so the code weakness was visible on the same page.

## Wrong answers

- "The aggregate is the objective answer." It is the answer to one weighting; a different weighting is a different winner.
- "Drop the aggregate and show only categories." The headline exists so people can decide; keep it, label its weights and put the categories under it.
- "Rank by win rate instead." Win rate hides magnitude; publish both and the paired interval.

## Taught in

The [eval pipeline capstone](../../../phases/19-capstone-projects/41-eval-pipeline/) shows the three layers of a report and the weighted aggregate, the [leaderboard aggregation capstone](../../../phases/19-capstone-projects/74-leaderboard-aggregation/) adds categories and intervals, and the [long context evaluation lesson](../../../phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/) warns that an aggregate hides what each task type does.
