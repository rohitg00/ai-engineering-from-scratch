---
id: negative-r-squared
title: An R-squared below zero on the test set
card: math-classical-ml
kind: concept
level: 1
roles: [ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [regression, r-squared, metrics, baseline]
minutes: 5
lessons: [phases/02-ml-fundamentals/02-linear-regression, phases/02-ml-fundamentals/09-model-evaluation]
manuals: []
practice: [gradient-descent-linear-regression]
cheatsheet: [classical-ml]
related: [math-classical-ml/scaler-fit-before-split]
updated: 2026-11-03
---

A regression report shows a negative R-squared on the test set. A teammate says the metric code must be broken, because R-squared lives between 0 and 1. How do you answer?

## Short answer

R-squared is one minus the ratio of the residual sum of squares to the total sum of squares around the mean. It is 1 for a perfect fit, 0 for a model that only predicts the mean, and below zero when the model does worse than that constant. A negative value is a real result, and it says the fitted model hurts on this data.

## Full answer

### The formula

```text
R-squared = 1 - SS_res / SS_tot
SS_res = sum of (y_true - y_pred)^2
SS_tot = sum of (y_true - y_mean)^2
```

The total sum of squares is the error of the simplest model: predict the mean every time. When the model's residuals are larger than that, the ratio is above 1 and the metric goes negative. There is no lower bound.

### How it happens on a test set

The model was fit on the training set. On the test set, a model that overfit the training data, or data whose distribution moved, can give predictions that are further from the targets than the test mean. The evaluation lesson prints a mean baseline next to the model for this reason, and a model must beat it. That baseline uses the mean of the training targets. It scores near 0 only when the test mean is close to the training mean, and below 0 when the two means differ.

### What to do with the number

1. Compare with the training R-squared. A high training value and a negative test value points at overfitting or a shift between the two sets.
2. Check the split. A time series shuffled before the split, or a scaler fit on all the data, gives a very different pair of numbers.
3. Report RMSE and MAE next to it. RMSE is in the units of the target. R-squared is a scale free fraction of the variance. Each answers a different question.

## Follow-ups

- **Level 1:** What value does a model that predicts the training mean get on the test set? Expected: near 0 when the test mean is close to the training mean, because the residual and total sums are almost the same; below 0 when the two means differ.
- **Level 2:** Training R-squared is high and the test value is negative. What does the gap say? Expected: the model fit the training data and does not transfer; suspect overfitting or a shift between the sets.
- **Level 2:** Why report R-squared next to RMSE? Expected: RMSE is in the units of the target and shows the size of a typical error; R-squared is a fraction of variance and has no units.
- **Level 3:** The target has a heavy tail. What else do you check? Expected: MAE next to MSE, because squared errors let a few outliers dominate both MSE and R-squared.

## Wrong answers

- "R-squared cannot be negative, so the code has a bug." The formula has no lower bound. A model that predicts worse than the mean gives a negative value.
- "Negative means the slope is negative." R-squared compares residuals with the variance around the mean. It carries no sign of a slope.
- "Clip it to zero in the report." That hides the fact that the mean would beat the model.

## Taught in

The [linear regression lesson](../../../phases/02-ml-fundamentals/02-linear-regression/) defines R-squared, and the [model evaluation lesson](../../../phases/02-ml-fundamentals/09-model-evaluation/) compares a model with the mean baseline.
