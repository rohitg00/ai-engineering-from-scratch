---
id: probability-statistics
title: Probability and Statistics for ML
code: PS
subtitle: Distributions, Bayes, tests, bootstrap, sampling from logits and Markov chains. From-scratch Python and SciPy.
hue: 160
sources: phases/01-math-foundations/06-probability-and-distributions, phases/01-math-foundations/07-bayes-theorem, phases/01-math-foundations/15-statistics-for-ml, phases/01-math-foundations/16-sampling-methods, phases/01-math-foundations/22-stochastic-processes
source_hash: 229da09316216de4
---

## Logits to a token
type: architecture
from: phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/16-sampling-methods/code/sampling.py

```arch
node | logits | 1,1 | Logits | one per token
node | temp | 2,1 | Temperature | divide by T
node | soft | 3,1 | Softmax | subtract max first
node | topk | 1,2 | Top-k | keep k, renormalize
node | topp | 2,2 | Top-p | smallest set with cumsum >= p
node | pick | 3,2 | Sample | sample_from_probs
edge | logits | temp |
edge | temp | soft |
edge | soft | topk | probs
edge | topk | topp | then
edge | topp | pick |
```

## Bayesian A/B test
type: flow
from: phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/07-bayes-theorem/code/bayes.py

1. **Prior**: start each variant at Beta(1, 1). It is uniform.
2. **Data**: A gets 50 clicks in 1000 views. B gets 65 clicks in 1000 views.
3. **Update**: `beta_update(alpha, beta_param, successes, failures)` adds the counts.
4. **Posteriors**: A is Beta(51, 951), mean 0.051. B is Beta(66, 936), mean 0.066.
5. **Monte Carlo**: draw 100,000 samples from each. P(B > A) is the fraction where B wins.
6. **Decide**: ship B above 0.95. Ship A below 0.05. Else collect more data.

## Tasks in code
type: task-table
span: 2
from: phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/07-bayes-theorem/code/bayes.py, phases/01-math-foundations/15-statistics-for-ml/code/statistics.py, phases/01-math-foundations/06-probability-and-distributions/code/probability.py

| Task | Code |
|---|---|
| Posterior from one test | `bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)` |
| Repeat the test | `sequential_bayes(prior, likelihood, false_positive_rate, num_tests)` |
| Spam filter with add-one smoothing | `NaiveBayes(smoothing=1.0)`, then `classifier.train(train_docs, train_labels)` |
| Loss from logits | `cross_entropy_loss(logits, target_index)` |
| Bootstrap confidence interval | `bootstrap_statistic(data, stat_func, n_bootstrap=5000, ci=95)` |
| Welch t-test, paired t-test | `two_sample_ttest(data1, data2)`, `paired_ttest(data1, data2)` |
| Effect size | `cohens_d(data1, data2)`, then `interpret_cohens_d(d)` |
| Correct for many tests | `bonferroni_correction(p_values, alpha=0.05)` |

## Sample from scratch
type: annotated-code
lang: python
from: phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/16-sampling-methods/code/sampling.py

```python
x = sample_exponential_inverse_cdf(lam)  # -log(u) / lam
x = rejection_sample(target_pdf, proposal_sample, proposal_pdf, M)  # accept rate 1/M
est = importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n)
idx = temperature_sample(logits, temperature)  # z / T, then softmax
idx = top_k_sample(logits, k)  # keep the k largest logits
idx = top_p_sample(logits, p)  # stop when cumsum >= p
z = reparam_sample(mu, sigma)  # mu + sigma * epsilon
y = gumbel_softmax_sample(log_probs, temperature)  # soft one-hot
```

## Library calls
type: annotated-code
lang: python
from: phases/01-math-foundations/06-probability-and-distributions/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md

```python
normal = stats.norm(loc=0, scale=1)
normal.cdf(1.96)  # P(X < 1.96)
normal.ppf(0.975)  # inverse CDF
samples = normal.rvs(size=10000)
probs = softmax(logits)  # from scipy.special
rng = np.random.default_rng(42)
token = rng.choice(len(logits), p=probs)
distribution = distribution @ P  # power method, repeat 100 times
eigenvalues = np.linalg.eigvals(P)
spectral_gap = 1 - sorted(np.abs(eigenvalues))[-2]  # mixing time near 1/gap
```

## Key formulas
type: concepts
from: phases/01-math-foundations/06-probability-and-distributions/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/15-statistics-for-ml/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md

- **Bayes**: $P(A \mid B) = \frac{P(B \mid A) \cdot P(A)}{P(B)}$. $P(B)$ is the normalizer.
- **Variance**: $\mathrm{Var}(X) = \mathbb{E}[X^2] - (\mathbb{E}[X])^2$. Sample variance divides by $n-1$.
- **Softmax with T**: $p_i = \exp(z_i / T) / \sum_j \exp(z_j / T)$.
- **Laplace smoothing**: add 1 to each count and the vocabulary size to the total.
- **Beta update**: prior Beta(a, b) with s successes and f failures gives Beta(a + s, b + f).
- **Importance weight**: $w(x) = p(x) / q(x)$. Average $f(x_i) \, w(x_i)$ over $x_i \sim q$.
- **Metropolis-Hastings**: accept with $\min(1, a)$. A symmetric proposal gives $a = p(x') / p(x)$.
- **Langevin**: $x_{t+1} = x_t - dt \, \nabla U(x_t) + \sqrt{2 T \, dt} \, z_t$.

## Distributions
type: command-table
from: phases/01-math-foundations/06-probability-and-distributions/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md

| Command | What it does |
|---|---|
| Bernoulli | Mean p, variance p(1-p). Binary classification |
| Categorical | Probabilities sum to 1. Softmax output |
| Poisson | Mean and variance both lambda. Event counts |
| Uniform(0, 1) | E[U] = 0.5, Var(U) = 1/12. Start of every sampler |
| Normal | 68%, 95%, 99.7% within 1, 2, 3 sigma |
| Beta(a, b) | Mean a/(a+b). Conjugate prior for Bernoulli |
| Exponential | Inverse CDF gives x = -ln(u) / lambda |
| Brownian motion | B(t) is normal with mean 0 and variance t |

## Pick a test
type: command-table
from: phases/01-math-foundations/15-statistics-for-ml/docs/en.md

| Command | What it does |
|---|---|
| One-sample t-test | Mean against mu_0. Degrees of freedom n - 1 |
| Welch t-test | Two independent groups. No equal variance assumption |
| Paired t-test | Same folds for both models. Test d_i against 0 |
| Chi-squared | Observed against expected frequencies |
| Mann-Whitney U | Two groups without a normal assumption |
| Wilcoxon signed-rank | Paired data. Good for 5 or 10 folds |
| Spearman rho | Monotonic relation on ranks. Robust to outliers |
| Bootstrap | Any metric. 95% CI from the 2.5th and 97.5th percentiles |

## Numbers and defaults
type: defaults
from: phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/15-statistics-for-ml/docs/en.md, phases/01-math-foundations/15-statistics-for-ml/code/statistics.py, phases/01-math-foundations/16-sampling-methods/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Significance level alpha | 0.05 | Reject H0 when p is below it |
| z for a 95% interval | 1.96 | x_bar plus or minus z times s / sqrt(n) |
| `n_bootstrap` | 5000 | The lesson range is 1000 to 10000 |
| CLT sample size | n >= 30 | Use n >= 100 for skewed data |
| Cohen's d, large effect | 0.8 | 0.2 small, 0.5 medium |
| MH acceptance, Gaussian proposal | 0.234 | High dimensions |
| Top-k `k` | 40 | Typical setting |
| Temperature with top-p | 0.7 + top-p 0.9 | General purpose |

## Troubleshooting
type: troubleshooting
from: phases/01-math-foundations/06-probability-and-distributions/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/15-statistics-for-ml/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| exp(102) overflows in softmax | Large logits | Subtract the max logit first |
| Sequence probability is 0.0 | Underflow after about 30 terms | Add log probabilities |
| Naive Bayes score is 0 | Unseen word has MLE count 0 | Add-one Laplace smoothing |
| 99% test gives about 1% sick | Rare prior dominates | Use the base rate. Run a second test |
| One of 20 metrics is significant | 64% chance of a false positive | Bonferroni: alpha / m |
| Tiny p-value on a 0.03% gain | Very large n | Report the effect size too |
| MH chain stuck or slow | Proposal scale too large or too small | Tune toward about 23% acceptance |
| A few samples dominate the estimate | Proposal q far from p | Self-normalize the weights |

## Questions
type: qa
from: phases/01-math-foundations/15-statistics-for-ml/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md

- **Is the p-value the chance that H0 is true?** No. It is P(data this extreme given H0).
- **What does a 95% CI mean?** 95% of intervals from repeated experiments contain the true mean.
- **Why the reparameterization trick?** Sampling blocks gradients. z = mu + sigma * epsilon is differentiable.
- **Why top-p over top-k?** Top-p adapts the candidate set to the model confidence.
- **How fast does a chain mix?** A spectral gap of 0.2 needs about 5 steps. 0.01 needs about 100.
- **How does MAP relate to regularization?** A Gaussian prior is L2. A Laplace prior is L1.

## Tips
type: tips
from: phases/01-math-foundations/15-statistics-for-ml/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/22-stochastic-processes/docs/en.md

- Evaluate both models on the same test set and the same folds.
- Report the p-value and the effect size together.
- Monte Carlo error is O(1 / sqrt(N)) in any dimension.
- Discard burn-in samples. Run several chains from different starts.
- A random walk drifts about sqrt(n) from the origin after n steps.
- Use T = 0.0 (greedy) for factual answers and deterministic tasks.
