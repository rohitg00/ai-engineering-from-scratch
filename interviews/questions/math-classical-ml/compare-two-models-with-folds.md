---
id: compare-two-models-with-folds
title: Decide whether a small win on one split is real
card: math-classical-ml
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [cross-validation, model-comparison, paired-test, evaluation]
minutes: 15
lessons: [phases/02-ml-fundamentals/09-model-evaluation]
manuals: []
practice: []
cheatsheet: [classical-ml]
related: [math-classical-ml/scaler-fit-before-split, math-classical-ml/threshold-precision-or-recall]
updated: 2026-11-03
---

Two variants of a classifier differ by one hyperparameter. On one held-out split, variant B beats variant A by a small margin, and the team wants to ship B. Design the evaluation that decides whether B is better, and say what you would report.

## Short answer

One split gives one noisy number, so the gap could be chance. Run k-fold cross-validation with the same folds for both variants, keep the per-fold differences, and test whether their mean is far from zero with a paired t-statistic. Report the mean and spread of each variant's fold scores, the mean difference and the statistic, and keep the test set out of the comparison.

## Full answer

### Why one split is not enough

A single split depends on which rows landed in each part. A different seed gives a different gap, and nothing in one number says how large that swing is. Folds show the spread.

### The design

1. Hold the test set out before anything else. It is for the final report, once.
2. Build K folds on the training data. The lesson uses K equal to 5 and names 5 or 10 as the standard choices. Stratify when the classes are imbalanced, so every fold keeps the class ratio.
3. Train and score both variants on the same folds, so the two scores in each fold are a pair. Pairing removes the fold-to-fold variation from the difference.
4. Compute the per-fold differences, their mean and their standard deviation, and the paired t-statistic: mean difference divided by the standard deviation over the square root of K. The lesson's threshold for 5 folds is a t-statistic whose magnitude exceeds 2.78, for significance at p below 0.05 with 4 degrees of freedom.
5. If the hyperparameter was chosen on these folds, wrap the whole thing in nested cross-validation: an inner loop picks the value, an outer loop measures it.
6. Repeat with a few fold seeds and check the conclusion holds.

### What to report

- Each variant's mean fold score with its spread.
- The mean difference, the statistic and the fold count.
- The effect size in product terms, so the team can weigh it against the cost of the change.
- One test set number for the variant you ship, measured once at the end.

### Caveats to say out loud

The folds share training rows, so the t-test is an approximation, not a clean independent sample. A significant difference can still be too small to matter. And a comparison made on the test set turns it into a validation set, which is the mistake the design is built to prevent.

## Follow-ups

- **Level 3:** Why must both variants use the same folds? Expected: pairing removes the fold-to-fold variation from the difference, so the test asks only about the variants.
- **Level 4:** What does an absolute t above 2.78 mean with five folds? Expected: with 4 degrees of freedom the mean difference is unlikely to be zero at the 5 percent level, so the gap is probably real.
- **Level 4:** How do you avoid tuning on the folds you report? Expected: nested cross-validation; the inner loop picks the hyperparameter and the outer loop measures it, so the reported folds never saw the choice.
- **Level 4:** The difference is significant and tiny. Do you ship B? Expected: weigh the effect size against the cost of the change; significance says the sign is reliable, not that it matters.

## Wrong answers

- "One held-out split is enough if it is large." A single split still depends on which rows landed where; folds show the spread.
- "Compare the two mean scores and pick the higher one." Without the per-fold pairing and the spread, a gap smaller than the fold noise looks like a win.
- "Use the test set to break the tie." The test set is single use; a choice made on it turns it into a validation set.

## Taught in

The [model evaluation lesson](../../../phases/02-ml-fundamentals/09-model-evaluation/) builds k-fold and stratified k-fold from scratch and ends with a paired comparison of two models.
