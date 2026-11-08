---
id: information-numerics
title: Information Theory and Numerical Stability
code: IT
subtitle: Entropy, cross-entropy and KL, stable softmax and log-sum-exp, float formats, PCA and distance choice.
hue: 280
sources: phases/01-math-foundations/09-information-theory, phases/01-math-foundations/10-dimensionality-reduction, phases/01-math-foundations/13-numerical-stability, phases/01-math-foundations/14-norms-and-distances
source_hash: d0a4a6ec261cbebc
---

## Information formulas
type: concepts
from: phases/01-math-foundations/09-information-theory/docs/en.md

- **Surprise**: $I(x) = -\log p(x)$. Base 2 gives bits. Base e gives nats.
- **Entropy**: $H(P) = -\sum_x p(x) \log p(x)$. Fair coin 1 bit. A 99% coin 0.08 bits.
- **Cross-entropy**: $H(P,Q) = -\sum_x p(x) \log q(x)$. A one-hot label gives $-\log q(\text{true class})$.
- **KL divergence**: $D_{KL}(P \Vert Q) = H(P,Q) - H(P)$. It is not symmetric.
- **Mutual information**: $I(X;Y) = H(X) + H(Y) - H(X,Y)$. Zero means independent.
- **Conditional entropy**: $H(Y \mid X) = H(X,Y) - H(X)$. Decision tree splits minimize it.
- **Perplexity**: $e^{H(P,Q)}$ in nats. Perplexity 50 is a uniform pick from 50 tokens.
- **Label smoothing**: $(1-\epsilon)\,\text{hard} + \epsilon / K$. With 0.1 and 4 classes the true class gets 0.925.
- **Units**: 1 nat is 1.4427 bits. PyTorch and TensorFlow use nats.

## Stable loss path
type: architecture
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/13-numerical-stability/code/numerical.py, phases/01-math-foundations/09-information-theory/docs/en.md

```arch
node | logits | 1,1 | Logits | raw scores z
node | max | 2,1 | Subtract max | c = max(x)
node | lse | 3,1 | Log-sum-exp | largest term is exp(0) = 1
node | lsm | 4,1 | log_softmax_stable | z minus lse
node | ce | 4,2 | Cross-entropy | minus log prob of true class
node | kl | 3,2 | KL divergence | CE minus entropy
node | ppl | 2,2 | Perplexity | exp of mean CE
edge | logits | max |
edge | max | lse | shifted
edge | lse | lsm |
edge | lsm | ce | log probs
edge | ce | kl |
edge | ce | ppl |
```

## Stable softmax, LSE and cross-entropy
type: annotated-code
lang: python
from: phases/01-math-foundations/13-numerical-stability/code/numerical.py

```python
def logsumexp_stable(values):
    c = max(values)                                # largest exponent becomes 0
    return c + math.log(sum(math.exp(v - c) for v in values))

def log_softmax_stable(logits):
    c = max(logits)
    lse = c + math.log(sum(math.exp(z - c) for z in logits))
    return [z - lse for z in logits]               # log probs, no overflow

def cross_entropy_stable(true_class, logits):
    log_probs = log_softmax_stable(logits)
    return -log_probs[true_class]                  # never calls log(0)
```

## Tasks in code
type: task-table
from: phases/01-math-foundations/09-information-theory/code/information_theory.py, phases/01-math-foundations/13-numerical-stability/code/numerical.py

| Task | Code |
|---|---|
| Entropy in bits | `entropy(probs, base=2)` |
| KL divergence | `kl_divergence(p, q, base=2)` |
| Perplexity from mean CE | `perplexity(avg_cross_entropy, base="e")` |
| Safe softmax | `softmax_stable(logits)` |
| Numerical gradient | `numerical_gradient(f, x, h=1e-5)` |
| Compare to backprop | `check_gradient(analytical, numerical)` |
| Clip the gradient norm | `clip_by_norm(gradients, max_norm)` |
| Variance with a large mean | `welford_variance(values)` |

## Float formats and limits
type: defaults
from: phases/01-math-foundations/13-numerical-stability/docs/en.md

| Setting | Default | Note |
|---|---|---|
| float64 max | 1.8e308 | 11 exponent bits, ~15-16 digits |
| float32 max | 3.4028235e+38 | 8 exponent bits, ~7-8 digits |
| float32 min normal | 1.175e-38 | Denormals reach 1.401e-45 |
| float32 exp overflow | exp(89.0) | Gives inf. exp(88.7) still fits |
| float32 exp underflow | exp(-104) | Gives 0.0 |
| float16 max | 65,504 | Gradients below ~6e-8 become 0 |
| bfloat16 max | 3.4e38 | 8 exponent bits, 7 mantissa bits |
| float32 machine epsilon | 1.19e-7 | Smallest e with 1.0 + e != 1.0 |

## Mixed precision with loss scaling
type: flow
from: phases/01-math-foundations/13-numerical-stability/docs/en.md

1. **Master weights**: keep a float32 copy of the weights.
2. **Forward pass**: run it in float16 for speed.
3. **Loss**: compute it in float32 to prevent overflow.
4. **Scale**: multiply the loss by a factor, for example 1024.
5. **Backward pass**: run it in float16. Gradients are 1024x larger.
6. **Unscale**: divide the gradients by 1024 before the update.
7. **Update**: change the float32 master weights.
8. **Dynamic scale**: start at 65536. Halve on inf. Double after N clean steps.

## Numerical bugs
type: troubleshooting
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/13-numerical-stability/code/numerical.py

| Symptom | Cause | Fix |
|---|---|---|
| Loss is NaN after a few epochs | Logits too large, softmax overflowed | Stable softmax, lower LR, clip gradients |
| Loss stuck at log(num_classes) | Near-uniform outputs, no learning | Check labels, loss and dead ReLUs |
| Val accuracy 1-3% low | Mixed precision without loss scaling | Dynamic loss scaling or bfloat16 |
| Gradient norm 0.0 in some layers | Dead ReLUs or float16 underflow | LeakyReLU or GELU, gradient scaling |
| Results differ between GPUs | Float addition is not associative | `torch.use_deterministic_algorithms(True)` |
| `exp()` returns inf in the loss | Raw logits without max subtraction | `torch.nn.functional.log_softmax()` |
| Diverges after float16 switch | Grads below 6e-8, values above 65,504 | AMP with loss scaling, or bfloat16 |
| Wrong variance for large values | Catastrophic cancellation | `welford_variance` or center the data |

## Knobs and thresholds
type: defaults
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Gradient check `h` | 1e-5 | Typical range 1e-5 to 1e-7 |
| Gradient check pass | 1e-7 | Above 1e-3 something is wrong |
| `max_norm` | 1.0 | Transformers. 0.5 for RL, 5.0 for simple nets |
| LayerNorm `epsilon` | 1e-5 | Prevents division by zero |
| Epsilon in log and divide | 1e-8 | `log(x + 1e-8)` |
| t-SNE perplexity | 5-50 | The lesson uses 30 |
| UMAP `n_neighbors` | 15 | With `min_dist` 0.1 |
| PCA cumulative variance | 0.95 | Or a 90-95% threshold |

## Pick a distance
type: command-table
from: phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/01-math-foundations/14-norms-and-distances/code/distances.py

| Command | What it does |
|---|---|
| `cosine_similarity(a, b)` | Text and embeddings. Ignores magnitude |
| `dot_product(a, b)` | Recommendation. Magnitude encodes popularity |
| `l2_distance(a, b)` | Pixels and spatial data at comparable scale |
| `l1_distance(a, b)` | Sparse high-dim features. Robust to outliers |
| `linf_distance(a, b)` | Worst-case deviation in one dimension |
| `mahalanobis_distance(x, y, cov_matrix)` | Outliers with correlated features |
| `jaccard_similarity(set_a, set_b)` | Sets and tags. IoU for segmentation |
| `edit_distance(s1, s2)` | Strings. Insert, delete or substitute |

## Reduce dimensions
type: concepts
from: phases/01-math-foundations/10-dimensionality-reduction/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/code/dim_reduction.py

- **Curse of dimensionality**: at 1000 dimensions the max/min distance ratio is ~1.02.
- **PCA**: center, covariance, `np.linalg.eigh`, sort by eigenvalue, keep the top k.
- **Explained ratio**: one eigenvalue divided by the sum of all eigenvalues.
- **Pick k**: keep 90-95% of variance, find the elbow, or sweep k on the task.
- **Reconstruction error**: the sum of the dropped eigenvalues. High error marks an outlier.
- **t-SNE**: keeps local neighbors. Stochastic and $O(n^2)$. Cluster gaps mean nothing.
- **UMAP**: faster than t-SNE. It keeps more global structure.
- **Kernel PCA**: PCA in a kernel feature space. RBF separates concentric circles.

## Questions
type: qa
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/01-math-foundations/09-information-theory/docs/en.md

- **Why subtract the max?** The largest term becomes exp(0) = 1. The sum is at least 1.
- **Why bfloat16 for training?** It has the float32 range. Loss scaling is usually unnecessary.
- **Why minimize cross-entropy?** It equals negative log-likelihood. H(P) is constant.
- **Why is KL not a distance?** It is not symmetric and fails the triangle inequality.
- **Why Wasserstein for GANs?** It gives gradients when distributions do not overlap.
- **Why does L1 give sparse weights?** Loss contours touch the L1 diamond at a corner.
- **Why centered differences?** The error is $O(h^2)$. Forward differences give $O(h)$.

## Tips
type: tips
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md

- Do not compare floats with `==`. Use `math.isclose()`.
- Check for nan and inf after each forward pass while you debug: `math.isfinite(x)`.
- Clamp inputs to exp: `exp(clamp(x, -80, 80))`.
- Clip by norm with `torch.nn.utils.clip_grad_norm_()`. It keeps the gradient direction.
- Check each new layer or loss with `torch.autograd.gradcheck()`.
- With L2-normalized embeddings, cosine and dot product give the same result.
