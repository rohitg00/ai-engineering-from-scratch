---
name: skill-ensemble-builder
description: Choose the right ensemble method and configure it for your problem
version: 1.0.0
phase: 2
lesson: 11
tags: [ensemble, bagging, boosting, random-forest, xgboost, stacking]
---

# Ensemble Method Selection Guide

Ensembles combine multiple models to produce better predictions than any single model. The question is always: which kind of ensemble, and when?

## Decision Checklist

1. What is the main problem with your current model?
   - High variance (overfitting): use bagging (Random Forest)
   - High bias (underfitting): use boosting (Gradient Boosting, XGBoost)
   - Both, or you want maximum accuracy: use stacking

2. How much data do you have?
   - Under 1,000 rows: Random Forest (robust, hard to misconfigure)
   - 1,000 to 100,000: XGBoost or LightGBM (best overall for tabular)
   - Over 100,000: LightGBM (fastest gradient boosting, handles large data well)

3. How much tuning time can you invest?
   - Minimal: Random Forest with defaults (almost always works)
   - Moderate: XGBoost with learning_rate=0.1, tune n_estimators with early stopping
   - Maximum: LightGBM or XGBoost with Bayesian hyperparameter search

4. Do you need interpretability?
   - Yes: single decision tree or small Random Forest with feature importance
   - Partial: gradient boosting with SHAP values
   - No: stacking or deep ensembles

5. Is the data noisy with many outliers?
   - Yes: Random Forest (bagging is robust to noise)
   - No: gradient boosting (can push accuracy further on clean data)

## When to use each method

**Random Forest (Bagging)**: your safe first choice. Trains many trees on bootstrap samples and averages. Reduces variance without increasing bias. Nearly impossible to overfit on moderate data. Minimal tuning needed: set n_estimators=100-500 and leave defaults.

**AdaBoost**: sequential boosting with sample reweighting. Works well with simple base learners (decision stumps). Sensitive to outliers and noisy labels because it upweights misclassified points. Largely replaced by gradient boosting in practice.

**Gradient Boosting**: fits each new tree to the residuals of the ensemble so far. Reduces bias. The most powerful method for tabular data. Requires tuning: learning_rate, n_estimators, max_depth, min_child_weight, subsample.

**XGBoost**: gradient boosting with regularization, second-order optimization, and systems-level speedups. Handles missing values natively. The default for Kaggle competitions and production ML on tabular data.

**LightGBM**: gradient boosting with leaf-wise growth (instead of level-wise). Faster than XGBoost on large datasets. Uses histogram-based splits. Best for datasets over 50k rows.

**CatBoost**: gradient boosting with native categorical feature handling. No need to one-hot encode. Good when you have many categorical features.

**Stacking**: trains a meta-learner on the predictions of multiple diverse base models. Use when you need the absolute best accuracy and have compute to spare. Always generate base model predictions via cross-validation to avoid leakage.

**Voting**: simplest ensemble. Hard voting (majority class) or soft voting (average probabilities). Quick way to combine 2-3 diverse models without a meta-learner.

## Common mistakes

- Using gradient boosting without early stopping (it will overfit if you let it run too many rounds)
- Setting learning_rate too high (above 0.3 usually causes instability)
- Not tuning max_depth for gradient boosting (default of unlimited or very deep trees overfit)
- Stacking with models that are all the same type (diversity is the point of stacking)
- Using AdaBoost on noisy data (outliers get higher and higher weight each round)
- Expecting Random Forest to fix underfitting (it reduces variance, not bias)

## Tuning priorities by method

**Random Forest:**
1. n_estimators: 100-500 (more is rarely worse, just slower)
2. max_depth: None (let trees grow fully) or cap at 10-20 for speed
3. max_features: "sqrt" for classification, "log2" or n/3 for regression

**XGBoost / LightGBM:**
1. learning_rate: 0.01-0.3 (lower is better if you have compute for more trees)
2. n_estimators: use early stopping on a validation set instead of guessing
3. max_depth: 3-8 (start with 6)
4. min_child_weight / min_data_in_leaf: 1-20 (higher prevents overfitting)
5. subsample: 0.7-1.0
6. colsample_bytree: 0.7-1.0
7. reg_alpha (L1) and reg_lambda (L2): 0-10

## Quick reference

| Method | Reduces | Speed | Tuning effort | Best for |
|--------|---------|-------|--------------|----------|
| Random Forest | Variance | Fast | Low | Noisy data, quick baseline |
| AdaBoost | Bias | Fast | Low | Simple base learners, clean data |
| Gradient Boosting | Bias | Medium | High | Tabular data, competitions |
| XGBoost | Both | Fast | High | Production tabular ML |
| LightGBM | Both | Fastest | High | Large datasets (50k+ rows) |
| CatBoost | Both | Medium | Medium | Many categorical features |
| Stacking | Both | Slow | High | Maximum accuracy, diverse models |
| Voting | Variance | Fast | None | Quick combination of 2-3 models |
