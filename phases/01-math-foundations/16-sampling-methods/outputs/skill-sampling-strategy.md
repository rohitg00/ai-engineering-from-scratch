---
name: skill-sampling-strategy
description: Choose the right sampling method for generation, estimation, or inference
version: 1.0.0
phase: 1
lesson: 16
tags: [sampling, mcmc, generation]
---

# Sampling Strategy Selection

How to pick the right sampling method for text generation, Bayesian inference, Monte Carlo estimation, and training.

## Decision Checklist

1. Are you generating output (text, images) or estimating a quantity (integral, expectation)?
2. Can you sample directly from the target distribution, or only evaluate its density?
3. Is the target distribution discrete or continuous?
4. What dimension is the sample space? Low (< 5), medium (5-100), or high (> 100)?
5. Do you need exact samples or approximate ones?
6. Do you need gradients through the sampling operation?

## When to use each method

| Method | When to use | Complexity | Exact? |
|---|---|---|---|
| Direct sampling | You have the CDF or can use a library function | O(1) per sample | Yes |
| Inverse CDF | Known closed-form CDF inverse (exponential, Cauchy) | O(1) per sample | Yes |
| Box-Muller | Need normal samples without a library | O(1) per sample | Yes |
| Rejection sampling | Can evaluate target PDF, low dimension (1-3) | O(1/acceptance) per sample | Yes |
| Importance sampling | Need expectations, not individual samples | O(n) for n samples | Approximate |
| Stratified sampling | Monte Carlo estimation, want lower variance | O(n) for n samples | Approximate |
| Metropolis-Hastings | High-dimensional, can evaluate unnormalized density | O(1) per step + burn-in | Asymptotically |
| Gibbs sampling | Can sample from each conditional distribution | O(d) per full sweep | Asymptotically |
| HMC/NUTS | High-dimensional continuous, smooth density | O(L * d) per step | Asymptotically |
| Temperature sampling | LLM text generation, control creativity | O(V) for vocab size V | N/A |
| Top-k sampling | LLM generation, remove unlikely tokens | O(V log k) | N/A |
| Top-p (nucleus) | LLM generation, adaptive candidate set | O(V log V) | N/A |
| Reparameterization | Need gradients through Gaussian sampling (VAEs) | O(d) | Yes |
| Gumbel-Softmax | Need gradients through categorical sampling | O(k) for k classes | Approximate |

## LLM generation settings

| Use case | Temperature | Top-p | Top-k | Notes |
|---|---|---|---|---|
| Factual Q&A | 0.0 (greedy) | -- | -- | Deterministic, no randomness |
| Code generation | 0.2-0.5 | 0.9 | -- | Low creativity, high coherence |
| General chat | 0.7 | 0.9 | -- | Balanced |
| Creative writing | 0.9-1.2 | 0.95 | -- | Higher diversity |
| Brainstorming | 1.0-1.5 | 0.95 | -- | Maximum diversity, may lose coherence |

Temperature and top-p can be combined. Apply temperature first (scale logits), then apply top-p filtering.

## MCMC method selection

| Property | Metropolis-Hastings | Gibbs | HMC/NUTS |
|---|---|---|---|
| Dimension | Any | Any (best < 100) | High (100+) |
| Requires conditionals | No | Yes | No |
| Requires gradient | No | No | Yes |
| Acceptance rate | Tune to ~23% | Always 100% | Tune to ~65% |
| Correlation | High (random walk) | Moderate | Low |
| Burn-in | Long | Moderate | Short |
| Best for | Exploration, simple models | Conjugate models, Bayesian networks | Continuous posteriors, deep probabilistic models |

## Common mistakes

- Using rejection sampling in high dimensions. Acceptance rate drops exponentially with dimension. Above 5 dimensions, switch to MCMC.
- Setting MCMC proposal variance too high or too low. Too high: most proposals rejected, chain stuck. Too low: all proposals accepted, chain moves slowly. Target ~23% acceptance for random walk MH.
- Forgetting burn-in. The first N samples from MCMC are biased by the starting point. Discard at least 1000 steps (or more for complex distributions).
- Using importance sampling with a proposal very different from the target. A few samples get enormous weights, making the estimate unreliable. Monitor the effective sample size: ESS = (sum w_i)^2 / sum(w_i^2).
- Using temperature > 0 for tasks that need deterministic output (e.g., classification, structured extraction). Use greedy (T=0) or beam search instead.
- Not combining top-p with temperature. Temperature alone does not remove garbage tokens from the long tail. Top-p does.
- Backpropagating through a standard sampling operation. Use reparameterization trick for continuous (Gaussian) and Gumbel-Softmax for discrete (categorical).

## Quick reference: variance reduction techniques

| Technique | How it works | Variance reduction |
|---|---|---|
| Stratified sampling | Divide space into strata, sample each | Always <= standard MC |
| Antithetic variates | Use both U and 1-U | Works for monotone functions |
| Control variates | Subtract a known-mean variable | Proportional to correlation |
| Importance sampling | Reweight samples from a better proposal | Depends on proposal quality |
| Latin hypercube | Stratify each dimension independently | Better than stratified in high-d |
