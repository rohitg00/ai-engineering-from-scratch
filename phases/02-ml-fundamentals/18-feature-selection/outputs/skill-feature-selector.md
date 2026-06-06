---
name: skill-feature-selector
description: Quick reference decision tree for choosing the right feature selection method
version: 1.0.0
phase: 2
lesson: 18
tags: [feature-selection, mutual-information, rfe, lasso, tree-importance]
---

# Feature Selection Strategy

A quick reference for picking and applying the right feature selection method.

## Step 1: Start with cleanup

Before applying any method, remove obviously useless features:

- **Constant features**: variance = 0. Remove them.
- **Near-constant features**: variance < 0.01 (or your threshold). Remove them.
- **Duplicate features**: identical columns. Keep one, drop the rest.
- **ID columns**: unique per row, carry no generalizable information. Remove them.

This takes seconds and can eliminate 10-30% of features in messy real-world datasets.

## Step 2: Choose a method based on your situation

### Quick Decision Tree

1. **< 50 features?** Start with mutual information ranking. Keep top K.
2. **50 - 500 features?** Use variance threshold first, then L1 (Lasso) if using a linear model, or tree importance if using trees.
3. **> 500 features?** Chain methods: variance threshold -> mutual information filter (top 50%) -> RFE on survivors.
4. **Need interpretability?** L1 regularization gives you exact zero/nonzero. Tree importance gives ranked scores.
5. **Need to capture nonlinear relationships?** Mutual information or tree-based importance. Avoid L1 (linear only).
6. **Need feature interactions?** RFE or tree-based importance. Filter methods miss interactions.

### Method Reference

| Method | When to Use | When to Avoid |
|--------|------------|---------------|
| Variance threshold | Always, as a first step | Never skip this |
| Mutual information | Quick ranking, nonlinear relationships | When you need feature interaction detection |
| RFE | Thorough selection, moderate feature count | Very expensive models, > 1000 features |
| L1 / Lasso | Linear models, fast embedded selection | Nonlinear problems, highly correlated features |
| Tree importance | Nonlinear relationships, feature interactions | Biased by high-cardinality features |
| Permutation importance | Model-agnostic validation, final check | Too slow for initial screening |

## Step 3: Validate your selection

- Compare model performance with selected features vs all features
- Use cross-validation, not a single train/test split
- If performance drops by more than 1-2%, you may have removed useful features
- If performance improves, you successfully removed noise

## Step 4: Handle common pitfalls

### Correlated features
- L1 arbitrarily picks one from a correlated group and zeros the others
- Compute the correlation matrix first and decide which correlated features to keep
- Tree importance spreads importance across correlated features

### Data leakage
- Fit feature selection on training data only
- Apply the same selection to test data
- In cross-validation, feature selection must happen inside each fold

### Overfitting to feature selection
- RFE with too many iterations can overfit to the training set
- Validate on held-out data, not the data used for selection
- Use stability selection (repeat on subsamples) for more robust results

## Step 5: Production checklist

- [ ] Variance threshold applied as first filter
- [ ] Feature selection fitted on training data only
- [ ] Selected features documented (names, method used, scores)
- [ ] Performance compared: selected features vs all features
- [ ] Cross-validated, not single-split evaluation
- [ ] Feature selection integrated into the training pipeline (not done manually)
- [ ] Monitoring in place for feature drift (selected features may become stale)
