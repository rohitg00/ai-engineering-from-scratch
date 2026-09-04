---
name: skill-classification-baseline
description: Establish a strong classification baseline before reaching for complex models
version: 1.0.0
phase: 2
lesson: 3
tags: [classification, logistic-regression, baseline, preprocessing]
---

# Classification Baseline Guide

Before trying complex models, establish a baseline with logistic regression. It trains in seconds, produces probabilities, and is fully interpretable. A surprising number of real-world problems never need anything fancier.

## Decision Checklist

1. Is the decision boundary likely linear?
   - Yes: logistic regression will probably be sufficient
   - No: you still want it as a baseline to measure improvement

2. How many features do you have?
   - Under 50: standard logistic regression works fine
   - 50 to 10,000: add L2 regularization (Ridge)
   - Over 10,000 (e.g., TF-IDF text features): use L1 regularization (Lasso) or LinearSVC

3. Is the dataset imbalanced?
   - Under 5:1 ratio: probably fine without adjustment
   - 5:1 to 50:1: use `class_weight="balanced"` in sklearn
   - Over 50:1: combine class weighting with appropriate metric (precision, recall, or F1)

4. Are features on different scales?
   - Always standardize before logistic regression. It uses gradient-based optimization, and unscaled features slow convergence or distort the decision boundary.

5. Are there missing values?
   - Impute before fitting. Logistic regression cannot handle NaNs.
   - Use median imputation for numeric columns, mode for categorical.

## When logistic regression is good enough

- Binary classification with mostly linear feature relationships
- You need probability outputs (not just class labels)
- Interpretability is required (coefficients indicate feature importance direction and relative magnitude after standardization)
- Training data is small (hundreds to low thousands of samples)
- You need a fast model for real-time serving (single dot product at inference)
- Regulatory or compliance requirements demand explainability

## When to upgrade

- Accuracy plateaus well below the target and you have tried feature engineering
- The relationship between features and target is clearly nonlinear (check residual plots)
- You have large tabular data (10k+ rows): try gradient boosting (XGBoost or LightGBM)
- Features have complex interactions that polynomial features cannot capture
- You have image, text, or sequential data: logistic regression on raw inputs will not work

## Preprocessing steps for a classification baseline

1. **Train/test split** first, before any preprocessing. This prevents data leakage.
2. **Handle missing values**: median impute numeric, mode impute categorical.
3. **Encode categoricals**: one-hot for low cardinality (under 10 values), target encoding for higher. Fit target encoding only on training folds (use out-of-fold encoding to prevent leakage).
4. **Scale numerics**: StandardScaler (zero mean, unit variance). Fit on train, transform both.
5. **Fit logistic regression** with `C=1.0` (default regularization).
6. **Evaluate**: confusion matrix, precision, recall, F1. Not just accuracy.
7. **Tune threshold**: default 0.5 is rarely optimal. Sweep 0.1 to 0.9 and pick the threshold that matches your precision/recall priority.

## Common mistakes

- Evaluating only accuracy on imbalanced data (a model predicting the majority class scores high but is useless)
- Forgetting to scale features (logistic regression with unscaled features trains slowly and converges to a worse solution)
- Using the test set to tune the decision threshold (use validation or cross-validation)
- Skipping the baseline and jumping straight to XGBoost (you lose interpretability and have no reference point)
- Not checking for multicollinearity (highly correlated features inflate coefficient variance)

## Quick reference

| Scenario | Model | Regularization | Key setting |
|----------|-------|---------------|-------------|
| Few features, interpretable | LogisticRegression | L2 (default) | C=1.0 |
| Many features, some irrelevant | LogisticRegression | L1 | penalty="l1", solver="saga" |
| High-dim sparse (text) | SGDClassifier | L1 or ElasticNet | loss="log_loss" |
| Imbalanced classes | LogisticRegression | L2 | class_weight="balanced" |
| Need probabilities | LogisticRegression | L2 | predict_proba() |
| Need class labels only | LinearSVC | L2 | Faster than LR for large data |
