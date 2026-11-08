# Evidence: cheatsheets/probability-statistics.md

Abbreviations: P = phases/01-math-foundations. L06 = P/06-probability-and-distributions, L07 = P/07-bayes-theorem, L15 = P/15-statistics-for-ml, L16 = P/16-sampling-methods, L22 = P/22-stochastic-processes. d = docs/en.md. L06/c = code/probability.py, L07/c = code/bayes.py, L15/c = code/statistics.py, L16/c = code/sampling.py.

## Logits to a token (architecture, 6 nodes, 5 edges)
- Logits, one per token: L16/d:244
- Temperature divides logits by T: L16/d:247, L16/d:544-546
- Softmax subtracts the max first: L16/d:538-542
- Top-k keeps k and renormalizes: L16/d:272-277
- Top-p smallest set with cumsum >= p: L16/d:288, 571
- Sample with sample_from_probs: L16/c:216, L16/d:547
- Top-k first, then top-p: L16/d:310

## Bayesian A/B test (flow, 6 steps)
1. Beta(1, 1) prior for both: L07/d:413, 356
2. A 50 of 1000, B 65 of 1000: L07/d:414
3. beta_update(alpha, beta_param, successes, failures): L07/c:213-214
4. Beta(51, 951) mean 0.051, Beta(66, 936) mean 0.066: L07/d:416-417
5. 100,000 samples each, fraction where B > A: L07/d:423-425
6. Ship B above 0.95, A below 0.05, else collect data: L07/d:428

## Tasks in code (task-table, 8 rows)
- bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01): L07/d:210
- sequential_bayes(prior, likelihood, false_positive_rate, num_tests): L07/c:11
- NaiveBayes(smoothing=1.0), classifier.train(train_docs, train_labels): L07/d:221, 281
- cross_entropy_loss(logits, target_index): L06/c:104
- bootstrap_statistic(data, stat_func, n_bootstrap=5000, ci=95): L15/c:298
- two_sample_ttest(data1, data2) uses welch_df, paired_ttest(data1, data2): L15/c:227-236
- cohens_d(data1, data2), interpret_cohens_d(d): L15/c:343, 356
- bonferroni_correction(p_values, alpha=0.05): L15/c:367

## Sample from scratch (annotated-code, 8 lines)
- sample_exponential_inverse_cdf(lam), -log(u) / lam: L16/d:455-457
- rejection_sample(target_pdf, proposal_sample, proposal_pdf, M), acceptance 1/M: L16/d:120, 465
- importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n): L16/d:478
- temperature_sample(logits, temperature): L16/d:544-547
- top_k_sample(logits, k): L16/d:555
- top_p_sample(logits, p), break when cumsum >= p: L16/d:563-572
- reparam_sample(mu, sigma) returns mu + sigma * epsilon: L16/d:583-585
- gumbel_softmax_sample(log_probs, temperature), soft one-hot: L16/c:336, L16/d:376

## Library calls (annotated-code, 10 lines)
- stats.norm(loc=0, scale=1), normal.rvs(size=10000), normal.cdf(1.96): L06/d:426-429
- normal.ppf(0.975) inverse CDF: L16/d:626
- softmax from scipy.special: L06/d:432-433
- np.random.default_rng(42), rng.choice(len(logits), p=probs): L16/d:618, 632
- distribution = distribution @ P for 100 steps, power method: L22/d:360-361, 366
- np.linalg.eigvals(P), spectral_gap, mixing time 1/spectral_gap: L22/d:381-385

## Key formulas (concepts, 8 bullets)
- Bayes theorem and normalizer: L07/d:49, 64
- Var(X) = E[X^2] - (E[X])^2: L06/d:164; n-1 sample variance: L15/d:78-83
- Softmax with temperature: L16/d:247
- Laplace smoothing formula: L07/d:143-146
- Beta(a + s, b + f): L07/d:362-367
- Importance weights and estimator: L16/d:140-143
- MH accept min(1, a), symmetric ratio p(x')/p(x): L22/d:204-208
- Langevin update: L22/d:163

## Distributions (command-table, 8 rows)
- Bernoulli mean p, variance p(1-p): L06/d:101-107
- Categorical sum to 1, softmax output: L06/d:111-115
- Poisson mean and variance lambda: L06/d:140-145
- Uniform E[U] = 0.5, Var(U) = 1/12, start of every method: L16/d:45, 53-54
- Normal 68%, 95%, 99.7%: L06/d:134-137
- Beta mean a/(a+b), conjugate for Bernoulli: L07/d:346, 353
- Exponential x = -ln(u) / lambda: L16/d:95-98
- Brownian motion mean 0 variance t: L22/d:60

## Pick a test (command-table, 8 rows)
- One-sample t-test, df n - 1: L15/d:208-213
- Welch t-test, no equal variances: L15/d:217-223
- Paired t-test on d_i against mu_0 = 0: L15/d:226-233
- Chi-squared observed against expected: L15/d:237-240
- Mann-Whitney U: L15/d:401
- Wilcoxon signed-rank, 5 or 10 folds: L15/d:402, 424
- Spearman rho, ranks, outliers: L15/d:107-127, 403
- Bootstrap any statistic, 2.5th and 97.5th percentiles: L15/d:358, 368

## Numbers and defaults (defaults, 8 rows)
- alpha 0.05: L15/d:182
- z = 1.96 for 95%: L15/d:193-195
- n_bootstrap=5000: L15/c:298; B = 1000 to 10000: L15/d:349
- n >= 30, n >= 100 for skewed: L15/d:435-436
- Cohen's d 0.2, 0.5, 0.8: L15/d:306-308
- Optimal MH acceptance 0.234: L16/d:216
- k = 40 typical: L16/d:281
- Temperature 0.7 + top-p 0.9: L16/d:306

## Troubleshooting (troubleshooting, 8 rows)
- exp(102) overflow, subtract max: L06/d:251-260
- Underflow after about 30 terms, use logs: L06/d:211-221
- Unseen word gives zero, Laplace smoothing: L07/d:140-146
- 99% test, rare disease, posterior 0.98%: L07/d:72-90
- 20 tests, 0.64 false positive chance, Bonferroni: L15/d:316-332
- 0.03% improvement significant with n = 1,000,000: L15/d:289-299, 312
- Proposal scale and 23% acceptance: L16/d:215, L22/d:218
- Self-normalized importance sampling: L16/d:148-151

## Questions (qa, 6 bullets)
- p-value is not P(H0 true): L15/d:177, 180
- 95% CI interpretation: L15/d:197-199
- Reparameterization trick: L16/d:314-335
- Top-p adapts the candidate set: L16/d:284, 303
- Spectral gap 0.2 about 5 steps, 0.01 about 100: L22/d:388
- Gaussian prior L2, Laplace prior L1: L07/d:188

## Tips (tips, 6 bullets)
- Same test set and same folds: L15/d:259-260, 276
- Report p-value and effect size: L15/d:312
- Monte Carlo error O(1 / sqrt(N)): L16/d:165, 168
- Burn-in and multiple chains: L22/d:215-217
- Random walk distance grows as sqrt(n): L22/d:41-43
- T = 0.0 greedy for factual Q&A and deterministic tasks: L16/d:259, 307
