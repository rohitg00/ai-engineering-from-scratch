---
id: scaler-fit-before-split
title: A test score that production never reaches
card: math-classical-ml
kind: debug
level: 2
roles: [ai-data-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-breadth]
tags: [data-leakage, train-test-split, cross-validation, preprocessing]
minutes: 8
lessons: [phases/02-ml-fundamentals/09-model-evaluation]
manuals: []
practice: []
cheatsheet: [classical-ml]
related: [math-classical-ml/negative-r-squared, math-classical-ml/compare-two-models-with-folds]
updated: 2026-11-03
---

A teammate standardizes the whole table with a scaler, then splits it into training, validation and test rows, and reports a test score. In production the score is well below that number. Name the fault in the pipeline and describe a setup where the test number predicts production.

## Short answer

The scaler saw the test rows, so the mean and standard deviation carried information from the test set into training. That is data leakage, and it makes the reported score optimistic. Split first, fit every preprocessing step on the training rows only, and apply the fitted transform to the other two sets.

## Full answer

### What leaked

Standardization subtracts a mean and divides by a standard deviation. Both are statistics of the rows the scaler saw. When those rows include the test set, the training data has been shaped by the test data. The evaluation lesson names this as its first example of leakage, next to two others that hide behind the same habit: future rows in a time series that was shuffled before the split, and a feature computed from the target.

### The three sets and their jobs

| Set | Share | Job |
|---|---|---|
| Training | 60-70 percent | the model fits these rows |
| Validation | 15-20 percent | choose hyperparameters and models |
| Test | 15-20 percent | report the final score, once |

The test set is a hold-out guarantee. After you look at its score and change the model, it is a second validation set, and its score no longer predicts unseen data.

### A pipeline that holds

1. Split before any statistic is computed. For a time series, split by time.
2. Fit the scaler, the encoder and any imputation on the training rows. Transform the other rows with those fitted values.
3. Inside cross-validation, repeat the fit inside each training fold. A transform fit on all rows before the folds leaks across every fold.
4. Use a stratified split when the classes are imbalanced, so each fold keeps the class ratio.
5. Check for duplicate rows across the splits.
6. Touch the test set once, at the end.

## Follow-ups

- **Level 2:** How does the same fault appear inside k-fold cross-validation? Expected: a transform fit on all rows before the folds leaks across every fold; fit it inside each training fold.
- **Level 2:** Why does reading the test score many times also inflate it? Expected: each change after a look fits the test set, so it becomes a second validation set.
- **Level 3:** The data has a time axis. What changes in the split? Expected: split by time, so the model never trains on rows after the ones it predicts; a shuffled split lets future rows into training.
- **Level 4:** How do you tune hyperparameters and still report an honest number? Expected: nested cross-validation with an inner loop for tuning and an outer loop for the estimate, or a validation set for tuning and a test set used once.

## Wrong answers

- "Scaling is a harmless transform, so the order does not matter." The mean and standard deviation are statistics of the data. Fitting them on test rows moves test information into training.
- "A leak this small cannot move the score much." The size is unknown until you remove it, and other leaks, such as a target-derived feature, hide behind the same habit.
- "Run the test set after each change to be safe." Each look and change fits the test set, and the number stops predicting production.

## Taught in

The [model evaluation lesson](../../../phases/02-ml-fundamentals/09-model-evaluation/) lists the common evaluation mistakes and builds the splits and the folds from scratch.
