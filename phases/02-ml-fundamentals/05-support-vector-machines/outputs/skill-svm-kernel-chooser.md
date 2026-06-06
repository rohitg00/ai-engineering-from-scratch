---
name: skill-svm-kernel-chooser
description: Choose the right SVM kernel and tune C and gamma for your problem
version: 1.0.0
phase: 2
lesson: 5
tags: [svm, kernel, classification, hyperparameter-tuning]
---

# SVM Kernel Selection Guide

SVMs are defined by two choices: the kernel (which determines the shape of the decision boundary) and the regularization parameters (which control the tradeoff between margin width and classification errors). Getting these right is the difference between a useless model and a strong one.

## Decision Checklist

1. Is the data linearly separable (or close to it)?
   - Yes: use linear kernel. It is faster and more interpretable.
   - No: go to step 2.

2. How many features vs samples?
   - Features >> samples (e.g., text with TF-IDF): use linear kernel. High-dimensional data is often linearly separable. RBF adds complexity for no gain.
   - Samples >> features (e.g., tabular data with 10-50 features): RBF kernel is the default choice.

3. Is the decision boundary expected to be smooth?
   - Smooth, continuous boundary: RBF kernel
   - Polynomial-shaped boundary: polynomial kernel (start with degree 2 or 3)
   - Domain knowledge suggests specific interaction terms: polynomial kernel with matching degree

4. How large is the dataset?
   - Under 10,000 samples: any kernel works, RBF is the safe default
   - 10,000 to 100,000: linear kernel or LinearSVC (primal formulation, O(n) per epoch)
   - Over 100,000: do not use kernel SVM. Switch to linear SVM, gradient boosting, or neural networks.

5. Did you scale the features?
   - SVMs require feature scaling. Always standardize (zero mean, unit variance) before fitting. Unscaled features distort the margin geometry.

## Kernel selection flowchart

```
Start
  |
  v
Features > 1000 or features >> samples?
  Yes --> Linear kernel (LinearSVC for speed)
  No  --> Dataset < 10k samples?
            Yes --> Try RBF first (best general-purpose kernel)
            No  --> Linear kernel (kernel SVMs are O(n^2) to O(n^3))
```

If RBF does not work well, try polynomial degree 2-3. If that fails, the problem may not be suited to SVMs.

## Tuning C (regularization)

C controls the penalty for misclassifications. It is inversely related to regularization strength.

| C value | Effect | When to use |
|---------|--------|-------------|
| 0.001 - 0.01 | Wide margin, many violations allowed | Noisy data, want generalization |
| 0.1 - 1.0 | Balanced | Good starting range |
| 10 - 1000 | Narrow margin, few violations | Clean data, need high accuracy |

Tuning strategy:
- Start with C=1.0
- Search on a log scale: [0.001, 0.01, 0.1, 1, 10, 100, 1000]
- Use cross-validation to pick the best value
- If best C is at the edge of your range, extend the range in that direction

## Tuning gamma (RBF kernel)

Gamma controls how far the influence of a single training point reaches. It defines the width of the Gaussian.

| gamma value | Effect | When to use |
|-------------|--------|-------------|
| Small (0.001) | Each point influences a large area. Smooth, simple boundary | Underfitting or few features |
| Medium (auto: 1/n_features) | sklearn default. Reasonable starting point | General use |
| Large (10+) | Each point influences only nearby points. Complex, wiggly boundary | Risk of overfitting |

Tuning strategy:
- Start with gamma="scale" (1 / (n_features * X.var()), the sklearn default)
- Search on a log scale: [0.001, 0.01, 0.1, 1, 10]
- Low gamma + high C tends to overfit
- High gamma + low C tends to underfit

## Joint C and gamma tuning

C and gamma interact. Always tune them together, not independently.

Recommended approach:
1. Coarse grid search: C in [0.01, 0.1, 1, 10, 100], gamma in [0.001, 0.01, 0.1, 1, 10] (25 combos)
2. Find the best region
3. Fine grid search around the best region (e.g., C in [5, 10, 20, 50], gamma in [0.05, 0.1, 0.2])
4. Use 5-fold cross-validation throughout

## Common mistakes

- Using RBF kernel on high-dimensional sparse data (linear is better and 100x faster)
- Forgetting to scale features (the single most common SVM mistake)
- Setting C too high on noisy data (memorizes noise instead of learning the boundary)
- Using kernel SVM on datasets over 50k samples (training time is prohibitive)
- Not tuning C and gamma together (they compensate for each other)
- Defaulting to polynomial degree 5+ (overfits aggressively, try 2 or 3 first)

## Quick reference

| Kernel | When to use | Key parameters | Training complexity |
|--------|------------|----------------|-------------------|
| Linear | Text/TF-IDF, many features, large data | C only | O(n) per epoch |
| RBF | General-purpose, under 10k samples | C, gamma | O(n^2) to O(n^3) |
| Polynomial | Known polynomial relationships | C, degree, coef0 | O(n^2) to O(n^3) |
| Sigmoid | Rarely useful (equivalent to two-layer neural net) | C, gamma, coef0 | O(n^2) to O(n^3) |
