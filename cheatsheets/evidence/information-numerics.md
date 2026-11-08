# Evidence: cheatsheets/information-numerics.md

Abbreviations: P1 = phases/01-math-foundations. L09 = P1/09-information-theory, L10 = P1/10-dimensionality-reduction, L13 = P1/13-numerical-stability, L14 = P1/14-norms-and-distances. d = docs/en.md. c09 = L09/code/information_theory.py, c10 = L10/code/dim_reduction.py, c13 = L13/code/numerical.py, c14 = L14/code/distances.py.

## Information formulas (concepts)
- Surprise -log p, bits and nats: L09/d:33-37
- Entropy formula, fair coin 1 bit, 99% coin 0.08 bits: L09/d:53-62
- Cross-entropy formula and one-hot form: L09/d:72-82
- KL = H(P,Q) - H(P), not symmetric: L09/d:90-99
- Mutual information, zero when independent: L09/d:105-112
- Conditional entropy, decision trees minimize it: L09/d:120-121, 134
- Perplexity e^H, perplexity 50 as 50 equal choices: L09/d:277-284
- Label smoothing formula, 0.1 and 4 classes gives 0.925: L09/d:217-223
- 1 nat = 1.4427 bits, PyTorch and TensorFlow use nats: L09/d:271

## Stable loss path (architecture)
- Logits raw scores z: L13/d:173
- Subtract max, c = max(x): L13/d:142-145, 162
- Log-sum-exp, largest term exp(0) = 1: L13/d:148
- log_softmax_stable, z - lse: c13:28-31
- Cross-entropy as minus log prob of true class: c13:39-41, L09/d:81
- KL divergence = CE minus entropy: L09/d:93
- Perplexity = exp of mean cross-entropy: L09/d:275, c09:69-71

## Stable softmax, LSE and cross-entropy (annotated-code)
- logsumexp_stable lines: c13:23-25
- log_softmax_stable lines: c13:28-31
- cross_entropy_stable lines: c13:39-41
- largest exponent becomes 0, no overflow: L13/d:148

## Tasks in code (task-table)
- entropy(probs, base=2): c09:13
- kl_divergence(p, q, base=2): c09:30
- perplexity(avg_cross_entropy, base="e"): c09:69
- softmax_stable(logits): c13:12
- numerical_gradient(f, x, h=1e-5): c13:66
- check_gradient(analytical, numerical, ...): c13:77
- clip_by_norm(gradients, max_norm): c13:94
- welford_variance(values): c13:141

## Float formats and limits (defaults)
- float64 1.8e308, 11 exponent bits, ~15-16 digits: L13/d:44
- float32 3.4028235e+38, 8 exponent bits, ~7-8 digits: L13/d:45, 111
- float32 min normal 1.175e-38, denorm 1.401e-45: L13/d:112-113
- exp(89.0) = inf, exp(88.7) fits: L13/d:121-122
- exp(-104) = 0.0: L13/d:124
- float16 max 65,504, underflow below ~6e-8: L13/d:46, 282
- bfloat16 3.4e38, 8 exponent, 7 mantissa: L13/d:47, 300
- machine epsilon 1.19e-7, 1.0 + e != 1.0: L13/d:600

## Mixed precision with loss scaling (flow)
1. float32 master copy: L13/d:274
2. forward in float16: L13/d:275
3. loss in float32, prevents overflow: L13/d:276
4. multiply loss by 1024: L13/d:287
5. backward in float16, gradients 1024x larger: L13/d:277, 288-289
6. divide gradients by 1024 before update: L13/d:290
7. update float32 master weights: L13/d:279
8. dynamic scaling, 65536, halve on inf, double after N steps: L13/d:294

## Numerical bugs (troubleshooting)
- Loss NaN after a few epochs: L13/d:365-367
- Loss stuck at log(num_classes): L13/d:369-371
- Validation accuracy 1-3% low: L13/d:373-375
- Gradient norms 0.0: L13/d:377-379
- Different results on another GPU, torch.use_deterministic_algorithms(True): L13/d:381-383
- exp() returns inf, torch.nn.functional.log_softmax(): L13/d:385-387
- Diverges after float16 switch, 6e-8 and 65,504: L13/d:389-391
- Variance with a large mean, cancellation, Welford or center: L13/d:99, 103, c13:141

## Knobs and thresholds (defaults)
- h = 1e-5, typical 1e-5 to 1e-7: L13/d:253
- relative error < 1e-7 perfect, > 1e-3 wrong: L13/d:262-264
- max_norm 1.0 transformers, 0.5 RL, 5.0 simpler: L13/d:336
- LayerNorm epsilon 1e-5, prevents division by zero: L13/d:359
- epsilon 1e-8, log(x + 1e-8): L13/d:235-236
- t-SNE perplexity 5-50, lesson uses 30: L10/d:102, 297
- UMAP n_neighbors 15, min_dist 0.1: L10/d:308
- cumulative variance 0.95, 90-95% threshold: L10/d:83, 89

## Pick a distance (command-table)
- cosine_similarity, text and embeddings: c14:44, L14/d:157-163, 355
- dot_product, recommendation, popularity: c14:40, L14/d:182, 364
- l2_distance, pixels, comparable scale: c14:27, L14/d:80-84, 356
- l1_distance, sparse high-dim, robust: c14:23, L14/d:53-54, 357
- linf_distance, worst-case deviation: c14:36, L14/d:133, 366
- mahalanobis_distance(x, y, cov_matrix), outliers, correlations: c14:57, L14/d:224-225, 360
- jaccard_similarity(set_a, set_b), sets, IoU: c14:98, L14/d:251, 255
- edit_distance(s1, s2), insert, delete, substitute: c14:110, L14/d:259

## Reduce dimensions (concepts)
- ratio ~1.02 at 1000 dimensions: L10/d:34-38
- PCA steps, np.linalg.eigh: L10/d:52-56, c10:18-20
- explained ratio formula: L10/d:185
- pick k: threshold 90-95%, elbow, downstream sweep: L10/d:89-91
- reconstruction error = sum of dropped eigenvalues, anomaly detection: L10/d:176, 193
- t-SNE local neighbors, stochastic, O(n^2), cluster distances not meaningful: L10/d:99-104
- UMAP faster, better global structure: L10/d:108-110
- Kernel PCA, RBF, concentric circles: L10/d:135, 161

## Questions (qa)
- subtract max, exp(0) = 1, sum at least 1: L13/d:148
- bfloat16 range, loss scaling usually unnecessary: L13/d:303, 308
- cross-entropy = NLL, entropy constant: L09/d:97, 257
- KL not symmetric, fails triangle inequality: L14/d:298-304
- Wasserstein gradients without overlap: L14/d:331
- L1 diamond corner gives sparsity: L14/d:406
- centered difference O(h^2), forward O(h): L13/d:251

## Tips (tips)
- never ==, math.isclose(): L13/d:81
- check nan/inf after forward pass, math.isfinite(x): L13/d:229, 239
- exp(clamp(x, -80, 80)): L13/d:234
- torch.nn.utils.clip_grad_norm_() preserves direction: L13/d:334
- torch.autograd.gradcheck() for a new layer or loss: L13/d:267
- L2-normalized embeddings, choice does not matter: L14/d:197
