---
name: skill-evaluation
description: Evaluation strategy checklist for classification and regression models
version: 1.0.0
phase: 2
lesson: 9
tags: [evaluation, metrics, cross-validation, model-selection]
---

# Model Evaluation Strategy

A checklist for correctly evaluating any ML model. Follow this sequence to avoid the most common evaluation mistakes.

## Step 1: Split the data correctly

- Split before any preprocessing (scaling, imputation, encoding)
- Use stratified splits for classification tasks
- Reserve a test set that you touch exactly once at the end
- For small datasets, use 5-fold or 10-fold cross-validation instead of a single split
- For time series, use time-based splits (never shuffle)

## Step 2: Pick the right metric

### Classification

| Situation | Use this metric | Why |
|-----------|----------------|-----|
| Balanced classes, simple comparison | Accuracy | Easy to interpret, meaningful when classes are equal |
| False positives are costly (spam filter, fraud alerts) | Precision | Measures how many flagged items are actually positive |
| False negatives are costly (cancer screening, security) | Recall | Measures how many actual positives you catch |
| Need to balance precision and recall | F1 Score | Harmonic mean, punishes extreme imbalance |
| Comparing models across thresholds | AUC-ROC | Threshold-independent ranking quality |
| Imbalanced data | F1, AUC-ROC, or PR-AUC | Accuracy is misleading with imbalanced classes |

### Regression

| Situation | Use this metric | Why |
|-----------|----------------|-----|
| Standard regression, outliers acceptable | RMSE | Same units as target, penalizes large errors |
| Outlier-robust evaluation | MAE | Treats all errors equally, not dominated by outliers |
| Comparing models on different scales | R-squared | Normalized 0-1 scale (fraction of variance explained) |
| Business requires dollar amounts | MAE or RMSE | Directly interpretable as error magnitude |

## Step 3: Establish baselines

Before evaluating your model, compute baseline performance:
- Classification: majority class predictor (always predict the most common class)
- Regression: always predict the mean of the training target
- Any model that cannot beat these baselines is not learning

## Step 4: Cross-validate

- Use K-fold (K=5 or K=10) for stable estimates
- Use stratified K-fold for classification
- Report mean and standard deviation across folds
- A model with mean=0.85 and std=0.02 is more trustworthy than mean=0.87 and std=0.10

## Step 5: Compare models statistically

- Do not pick the model with the highest average score without checking significance
- Use a paired t-test across cross-validation folds
- If |t| < 2.78 (for K=5, df=4, p<0.05), the difference may be due to chance
- Consider the simpler model when performance differences are not significant

## Step 6: Check for common mistakes

- Data leakage: did any test data information flow into training? (scaling before splitting, target-derived features)
- Class imbalance: is accuracy hiding poor minority-class performance?
- Overfitting: is the gap between training and validation performance large?
- Too many evaluations: have you looked at the test set more than once?

## Step 7: Report final performance

- Train on train + validation combined
- Evaluate on the held-out test set exactly once
- Report the chosen metric with confidence intervals if possible
- State the baseline comparison (how much better than random/mean)
