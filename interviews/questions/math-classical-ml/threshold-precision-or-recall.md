---
id: threshold-precision-or-recall
title: Pick a threshold when 95 percent of the data is negative
card: math-classical-ml
kind: tradeoff
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-breadth, screen]
tags: [classification, precision, recall, threshold, imbalance]
minutes: 8
lessons: [phases/02-ml-fundamentals/03-logistic-regression, phases/02-ml-fundamentals/09-model-evaluation]
manuals: []
practice: [logistic-regression]
cheatsheet: [classical-ml]
related: [math-classical-ml/logistic-loss-on-separable-data, math-classical-ml/negative-r-squared]
updated: 2026-11-03
---

A binary classifier reports 95 percent accuracy on a dataset where 95 percent of the rows are negative. The product owner is happy. You are not. Which numbers do you ask for, and how do you choose the decision threshold for this product?

## Short answer

A model that always says negative also gets that accuracy, so the number proves nothing. Ask for the confusion matrix, then precision, recall and F1 at the current threshold, and the AUC-ROC for the ranking. Move the threshold from the default of 0.5 toward the error that costs the product more: raise it when a false positive is expensive, lower it when a missed positive is expensive.

## Full answer

### The four counts

| | Predicted positive | Predicted negative |
|---|---|---|
| Actually positive | true positive | false negative |
| Actually negative | false positive | true negative |

Precision is true positives over all predicted positives. Recall is true positives over all actual positives. F1 is their harmonic mean. Accuracy mixes the two error types with the class sizes, so on imbalanced data it tracks the majority class.

### What the threshold does

The model outputs a probability. The decision compares it with a threshold. A higher threshold predicts positive less often: precision rises and recall falls. A lower threshold does the reverse. The lesson on logistic regression sweeps thresholds of 0.3, 0.4, 0.5, 0.6 and 0.7 on one model and prints the four metrics at each, which is the table to show the product owner.

### Which way to move

- When a false positive costs more, such as a filter that blocks a real message, favor precision and raise the threshold.
- When a false negative costs more, such as a screen that misses a disease, favor recall and lower the threshold.
- When neither clearly dominates, report F1, and show the precision and recall behind it.

### The threshold-free view

AUC-ROC plots the true positive rate against the false positive rate at every threshold. It measures how well the model ranks positives above negatives: 0.5 is a random ranking, 1.0 is a perfect one. Use it to compare models, then pick the threshold from the product's costs.

## Follow-ups

- **Level 2:** What precision and recall does the always-negative model get? Expected: recall is 0, because it finds no positives, and precision is undefined or set to 0 because it predicts none.
- **Level 2:** Why is F1 a harmonic mean rather than an arithmetic mean? Expected: the harmonic mean is pulled toward the smaller value, so a model cannot hide a near-zero recall behind a high precision.
- **Level 3:** How do you keep the threshold choice honest? Expected: pick it on the validation set, not the test set, and report the test metrics at that fixed threshold once.
- **Level 3:** When is AUC-ROC the wrong summary? Expected: when the positive class is rare and the product cares about the precision of the top predictions; a precision-recall curve shows that part of the picture.

## Wrong answers

- "Accuracy is 95 percent, so the model is good." The always-negative model gets the same number. Accuracy hides the minority class.
- "Keep the threshold at 0.5 because that is where the sigmoid crosses." The default is only the point where the model is unsure. The product's costs decide the cut.
- "Pick the threshold that gives the best test F1." That fits the test set. Choose it on validation data and report the test score once.

## Taught in

The [logistic regression lesson](../../../phases/02-ml-fundamentals/03-logistic-regression/) builds the metrics and sweeps the threshold, and the [model evaluation lesson](../../../phases/02-ml-fundamentals/09-model-evaluation/) adds AUC-ROC and the imbalance example.
