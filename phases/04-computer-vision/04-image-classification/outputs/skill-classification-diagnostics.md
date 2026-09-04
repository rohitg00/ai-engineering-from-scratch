---
name: skill-classification-diagnostics
description: Given a confusion matrix and class names, surface per-class failures and propose the single most impactful fix
version: 1.0.0
phase: 4
lesson: 4
tags: [computer-vision, classification, evaluation, debugging]
---

# Classification Diagnostics

A reading lens for confusion matrices. Aggregate accuracy tells you a classifier works. The confusion matrix tells you *what it does not know yet*.

## When to use

- First look at a trained classifier's validation performance.
- Between training runs to decide what to change next.
- Before shipping a model: verifying that no critical class is failing silently.
- Debugging a production regression where overall accuracy dropped one point and you need to know why.

## Inputs

- `cm`: CxC confusion matrix (rows = true, cols = predicted).
- `labels`: list of C class names, in the same order.
- Optional `class_priors`: per-class training frequency (defaults to the row sums of `cm`).

## Steps

1. **Compute per-class metrics.** Treat any division by zero as the metric being undefined for that class, and report it as `n/a`; never substitute silently with 0.
   - precision_i = cm[i,i] / sum(cm[:, i])   (undefined when the class was never predicted)
   - recall_i    = cm[i,i] / sum(cm[i, :])   (undefined when the class has no ground-truth samples)
   - f1_i        = 2 * p * r / (p + r)        (undefined when either component is undefined)

2. **Rank up to three worst classes** by F1. If the confusion matrix has fewer than three classes, rank however many exist. Exclude classes with all metrics undefined.

3. **Find the top off-diagonal cell per row** — the one class that most commonly steals from this class. Report as `true -> predicted`.

4. **Classify the failure mode** for each worst class. Use these quantitative thresholds so the label is reproducible:
   - `ambiguity` — bidirectional confusion with another class: both `cm[i,j] / sum(cm[i, :]) >= 0.15` and `cm[j,i] / sum(cm[j, :]) >= 0.15`.
   - `imbalance` — the class has `< 0.5x` the training count of its top confuser.
   - `label_noise` — `|precision_i - recall_i| >= 0.2` and the class is not on the imbalance / ambiguity paths.
   - `systematic` — no single confuser exceeds 0.2 share of this class's errors; errors spread across three or more other classes.

5. **Recommend the single most impactful next action**:
   - `ambiguity` -> collect or synthesise discriminative examples, add targeted augmentation that preserves the distinguishing feature.
   - `imbalance` -> oversample the minority class or apply class-weighted loss.
   - `label_noise` -> audit a stratified sample of the class; fix mislabels before any other change.
   - `systematic` -> increase data for the class or fine-tune with a higher weight on this class's loss.

## Report

```
[diagnostics]
  aggregate accuracy: X.XX
  macro F1:           X.XX

[top-3 worst classes]
  1. class <name>  F1 = X.XX  prec = X.XX  rec = X.XX
     top confusion: <name> -> <other>  (N cases)
     failure mode:  ambiguity | imbalance | label_noise | systematic
     action:        <one sentence>

  2. ...
  3. ...

[recommendation]
  single biggest lever: <one sentence naming the class and the fix>
```

## Rules

- Return at most three classes. More hides the signal.
- Name the dominant confuser for each worst class; never summarise as "confuses with many".
- Ground every recommendation in the confusion matrix evidence. No generic "add more data" without specifying which class.
- When precision and recall disagree by more than 0.2, always flag label noise as a candidate — real classes usually have aligned P and R after training.
