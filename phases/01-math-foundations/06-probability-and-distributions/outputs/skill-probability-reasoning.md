---
name: skill-probability-reasoning
description: Choose the right probability distribution for a given ML problem
version: 1.0.0
phase: 1
lesson: 6
tags: [probability, distributions, modeling]
---

# Probability Distribution Selection

How to pick the right distribution when modeling data, designing loss functions, or setting priors.

## Decision Checklist

1. Is the outcome discrete (categories, counts) or continuous (measurements, scores)?
2. Is the outcome bounded (e.g., [0, 1]) or unbounded?
3. How many possible outcomes are there? Two? k? Infinite?
4. Is the data symmetric or skewed?
5. Are events independent or correlated?
6. Are you modeling a rate, a count, a proportion, or a measurement?

## Distribution decision tree

```
Is the variable discrete?
  Yes --> Only 2 outcomes? --> Bernoulli (p)
     |    k outcomes, one trial? --> Categorical (p1...pk)
     |    k outcomes, n trials? --> Multinomial (n, p1...pk)
     |    Count of successes in n trials? --> Binomial (n, p)
     |    Count of events per interval? --> Poisson (lambda)
     |    Count of trials until first success? --> Geometric (p)
     |    Count of trials until r successes? --> Negative Binomial (r, p)
  No --> Symmetric, bell-shaped? --> Normal (mu, sigma)
     |   Positive values, right-skewed? --> Log-normal or Exponential
     |   Bounded in [0, 1]? --> Beta (alpha, beta)
     |   Positive values, flexible shape? --> Gamma (alpha, beta)
     |   Time between events? --> Exponential (lambda)
     |   Heavy tails needed? --> Student's t (nu) or Cauchy
     |   Multivariate, bell-shaped? --> Multivariate Normal
     |   On a simplex (sums to 1)? --> Dirichlet (alpha)
```

## Mapping real-world ML scenarios to distributions

| Scenario | Distribution | Parameters |
|---|---|---|
| Binary classification output | Bernoulli | p = sigmoid(logit) |
| Multi-class classification output | Categorical | p = softmax(logits) |
| Token prediction in language models | Categorical over vocab | p from softmax |
| Pixel intensity (normalized) | Beta or Uniform [0, 1] | Depends on image stats |
| Word count in a document | Poisson | lambda = avg word count |
| Time between user requests | Exponential | lambda = request rate |
| Measurement error | Normal | mu = 0, sigma from data |
| Weight initialization | Normal or Uniform | Kaiming/Xavier rules |
| VAE latent space prior | Standard Normal | mu = 0, sigma = 1 |
| Bayesian prior on proportions | Beta | alpha, beta from belief |
| Bayesian prior on category weights | Dirichlet | alpha vector |
| Noise in regression targets | Normal | mu = 0, sigma estimated |
| Outlier-robust regression | Student's t | low degrees of freedom |
| Duration/lifetime modeling | Weibull or Gamma | shape and scale |
| Topic distribution per document (LDA) | Dirichlet | alpha < 1 for sparse |

## When distributions go wrong

- Using Normal when data has a hard lower bound (e.g., prices, distances). The normal assigns nonzero probability to negative values. Use log-normal or gamma instead.
- Using Poisson when the variance differs from the mean. Poisson assumes mean = variance. If variance > mean, use negative binomial.
- Using Bernoulli for multi-class problems. Bernoulli is strictly binary. Use categorical for k > 2.
- Assuming independence when observations are correlated. Time series, spatial data, and grouped data violate independence. Use autoregressive or hierarchical models.

## Common mistakes

- Confusing PDF values with probabilities. A PDF can exceed 1. Probability comes from integrating the PDF over an interval.
- Forgetting that softmax outputs are categorical probabilities, not independent Bernoulli probabilities. They sum to 1 by construction.
- Using a uniform prior when you have domain knowledge. Informative priors reduce variance without biasing the result if chosen well.
- Treating log-probabilities as probabilities. Log-probs are always negative (or zero). They do not sum to 1.

## Quick reference: distribution properties

| Distribution | Support | Mean | Variance | Key property |
|---|---|---|---|---|
| Bernoulli(p) | {0, 1} | p | p(1-p) | Simplest discrete |
| Binomial(n, p) | {0..n} | np | np(1-p) | Sum of n Bernoulli |
| Poisson(lam) | {0, 1, 2, ...} | lam | lam | Mean = variance |
| Normal(mu, s^2) | (-inf, inf) | mu | s^2 | Max entropy for given mean/var |
| Exponential(lam) | [0, inf) | 1/lam | 1/lam^2 | Memoryless |
| Beta(a, b) | [0, 1] | a/(a+b) | ab/((a+b)^2(a+b+1)) | Conjugate to Binomial |
| Gamma(a, b) | (0, inf) | a/b | a/b^2 | Conjugate to Poisson |
| Dirichlet(alpha) | Simplex | alpha_i/sum | (see formula) | Conjugate to Categorical |
