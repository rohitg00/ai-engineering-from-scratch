---
name: skill-naive-bayes-chooser
description: Choose the right Naive Bayes variant for your classification task
phase: 2
lesson: 14
---

You are an expert in probabilistic classification. When someone needs to choose a Naive Bayes variant, walk them through this decision process.

## Decision Checklist

### Step 1: What are your features?

- **Word counts or TF-IDF values** -> MultinomialNB
- **Continuous measurements (temperature, height, sensor readings)** -> GaussianNB
- **Binary indicators (word present/absent, checkbox states)** -> BernoulliNB
- **Mixed types** -> Split into subsets, or convert all to one type

### Step 2: How much data do you have?

- **Under 1,000 samples**: Naive Bayes is a strong choice. Its strong prior (independence assumption) prevents overfitting.
- **1,000 to 50,000 samples**: NB is still competitive. Compare against logistic regression.
- **Over 50,000 samples**: Logistic regression or gradient boosting will likely outperform NB. Use NB as a baseline.

### Step 3: Tune smoothing

- Start with alpha=1.0 (Laplace smoothing).
- If accuracy is low and you have enough data, try alpha=0.1 or 0.01.
- If the model is overfitting (train >> test accuracy), increase alpha to 5.0 or 10.0.
- Always validate smoothing with cross-validation, not a single train/test split.

### Step 4: Check assumptions

- **MultinomialNB**: Features must be non-negative. If you have negative values, shift or use GaussianNB.
- **GaussianNB**: Works best when features are roughly bell-shaped within each class. Check with histograms.
- **BernoulliNB**: Binarize your features first. Choose the threshold carefully (for text: present=1, absent=0).

## Common Mistakes

1. **Using GaussianNB on text data.** Word counts are not Gaussian. Use MultinomialNB.
2. **Forgetting Laplace smoothing.** A single unseen word zeros out the entire probability. Always smooth.
3. **Trusting the probability outputs.** NB probabilities are poorly calibrated. Use them for ranking, not as confidence scores. If you need calibrated probabilities, use CalibratedClassifierCV.
4. **Ignoring class imbalance.** NB priors reflect class frequencies. With 99% negative and 1% positive, the prior overwhelms the likelihood. Adjust priors manually or resample.

## Quick Reference

| Question | MultinomialNB | GaussianNB | BernoulliNB |
|----------|:---:|:---:|:---:|
| Text classification? | Yes | No | Maybe (short text) |
| Continuous features? | No | Yes | No |
| Binary features? | No | No | Yes |
| Very fast training needed? | Yes | Yes | Yes |
| Small training set? | Good | Good | Good |
| Need calibrated probabilities? | No | No | No |

## When NOT to Use Naive Bayes

- Features are highly correlated and you have enough data for a model that handles correlations (logistic regression, gradient boosting)
- You need the best possible accuracy and have plenty of data
- Your features are images, sequences, or graphs (use neural networks)
- You need a model that captures feature interactions (use tree-based methods)
