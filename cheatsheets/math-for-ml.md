---
id: math-for-ml
title: Math for Machine Learning
code: MM
subtitle: Gradients, probability, information, optimizers, decompositions and float safety. NumPy, SciPy and PyTorch.
hue: 260
sources: phases/01-math-foundations/02-vectors-matrices-operations, phases/01-math-foundations/04-calculus-for-ml, phases/01-math-foundations/05-chain-rule-and-autodiff, phases/01-math-foundations/06-probability-and-distributions, phases/01-math-foundations/07-bayes-theorem, phases/01-math-foundations/08-optimization, phases/01-math-foundations/09-information-theory, phases/01-math-foundations/10-dimensionality-reduction, phases/01-math-foundations/11-singular-value-decomposition, phases/01-math-foundations/12-tensor-operations, phases/01-math-foundations/13-numerical-stability, phases/01-math-foundations/14-norms-and-distances, phases/01-math-foundations/16-sampling-methods, phases/01-math-foundations/17-linear-systems
source_hash: 9cf5b9af88d8d2f2
---

## Computational graph, forward and backward
type: architecture
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md

```arch
node | x1 | 1,1 | x1 = 2 | dy/dx1 = 3
node | x2 | 1,2 | x2 = 3 | dy/dx2 = 2
node | mul | 2,1 | Multiply | a = 6
node | b | 2,2 | b = 1 | dy/db = 1
node | add | 3,1 | Add | c = 7
node | relu | 4,1 | relu | y = 7
node | seed | 4,2 | Seed | dy/dy = 1
edge | x1 | mul |
edge | x2 | mul |
edge | mul | add | a
edge | b | add |
edge | add | relu | c
edge | relu | seed | backward
```

## Key formulas
type: concepts
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/09-information-theory/docs/en.md, phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md

- **Chain rule**: $\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$
- **Bayes**: $P(A \mid B) = \frac{P(B \mid A) \cdot P(A)}{P(B)}$
- **Entropy**: $H(P) = -\sum_{x} p(x) \log(p(x))$
- **Cross-entropy**: $H(P, Q) = -\sum_{x} p(x) \log(q(x))$
- **KL divergence**: $D_{KL}(P \,\|\, Q) = H(P, Q) - H(P)$. Not symmetric.
- **Log-sum-exp**: $\log \sum_i e^{x_i} = \max(x) + \log \sum_i e^{x_i - \max(x)}$
- **Cosine similarity**: $\frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}$, from -1 to +1
- **SVD**: $A = U \Sigma V^T$. Rank $k$: $A_k = U_k \Sigma_k V_k^T$

## Update rules
type: concepts
from: phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md

- **Gradient descent**: $w = w - \text{lr} \cdot \text{gradient}$
- **Momentum**: $v = \beta v + \text{gradient}$, then $w = w - \text{lr} \cdot v$
- **Adam moments**: $m = \beta_1 m + (1 - \beta_1) g$, $v = \beta_2 v + (1 - \beta_2) g^2$
- **Bias correction**: $\hat{m} = m / (1 - \beta_1^t)$, $\hat{v} = v / (1 - \beta_2^t)$
- **Adam step**: $w = w - \text{lr} \cdot \hat{m} / (\sqrt{\hat{v}} + \epsilon)$
- **Cosine schedule**: $\text{lr}_{\min} + 0.5 (\text{lr}_{\max} - \text{lr}_{\min})(1 + \cos(\pi t / T))$
- **Newton step**: $w_{\text{new}} = w_{\text{old}} - H^{-1} \cdot \text{gradient}$
- **Temperature**: $p_i = e^{z_i / T} / \sum_j e^{z_j / T}$

## Tasks in NumPy
type: task-table
from: phases/01-math-foundations/02-vectors-matrices-operations/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/01-math-foundations/12-tensor-operations/docs/en.md

| Task | Code |
|---|---|
| Dense layer | `np.maximum(0, weights @ inputs + bias)` |
| Solve a square system | `np.linalg.solve(A, b)` |
| Least squares | `np.linalg.lstsq(X, y, rcond=None)[0]` |
| Thin SVD | `U, S, Vt = np.linalg.svd(A, full_matrices=False)` |
| Rank k approximation | `U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]` |
| Pseudoinverse solve | `np.linalg.pinv(A) @ b` |
| Row norms | `np.linalg.norm(X, axis=1, keepdims=True)` |
| Batched matmul | `np.einsum("bij,bjk->bik", batch_A, batch_B)` |

## Tasks in PyTorch and SciPy
type: task-table
from: phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

| Task | Code |
|---|---|
| AdamW for transformers | `torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)` |
| Cosine schedule | `torch.optim.lr_scheduler.CosineAnnealingLR(adam, T_max=100)` |
| Clip by norm | `torch.nn.utils.clip_grad_norm_()` |
| Check a backward pass | `torch.autograd.gradcheck()` |
| Stable log of softmax | `torch.nn.functional.log_softmax()` |
| Inverse CDF of N(0, 1) | `stats.norm(loc=0, scale=1).ppf(0.975)` |
| PCA to 2D | `SklearnPCA(n_components=2).fit_transform(X)` |
| t-SNE to 2D | `TSNE(n_components=2, perplexity=30, random_state=42)` |

## Autograd in a few lines
type: annotated-code
lang: python
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md

```python
x = torch.tensor(2.0, requires_grad=True)  # record operations on x
y = x ** 2 + 3 * x + 1                     # builds the graph
y.backward()                               # reverse mode pass
print(x.grad)                              # 7.0 = 2*x + 3
def __mul__(self, other):
    out = Value(self.data * other.data, (self, other), '*')
    def _backward():
        self.grad += other.data * out.grad  # local grad times upstream
        other.grad += self.data * out.grad  # += sums over all uses
    out._backward = _backward
    return out
self.grad = 1.0                            # seed dy/dy = 1
for v in reversed(topo):                   # output to inputs
    v._backward()                          # chain rule at each node
```

## Stable softmax and cross-entropy
type: annotated-code
lang: python
from: phases/01-math-foundations/13-numerical-stability/docs/en.md

```python
def softmax_stable(logits):
    max_logit = max(logits)                           # subtract the max first
    exps = [math.exp(z - max_logit) for z in logits]  # largest term is 1
    total = sum(exps)
    return [e / total for e in exps]
def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp     # stay in log space
    return -log_prob
```

## PCA with SVD
type: flow
from: phases/01-math-foundations/10-dimensionality-reduction/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md

1. **Center**: subtract the mean from each feature.
2. **Covariance**: $C = \frac{1}{n-1} X^T X$ for centered X.
3. **Decompose**: call `np.linalg.svd(A)` on the data. Avoid eig of $A^T A$.
4. **Components**: the right singular vectors V are the principal components.
5. **Variance**: component i explains $\sigma_i^2 / (n-1)$.
6. **Choose k**: keep components up to 90 to 95% cumulative variance.
7. **Project**: keep the top k directions and drop the rest.

## Defaults and numbers
type: defaults
from: phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Adam lr | 0.001 | start here for most problems |
| Adam beta2 | 0.999 | beta1 is 0.9 |
| Adam epsilon | 1e-8 | avoids division by zero |
| SGD momentum lr | 0.01 | with momentum 0.9 |
| Gradient check h | 1e-5 | 1e-5 to 1e-7 is typical |
| Transformer max_norm | 1.0 | 0.5 for RL, 5.0 for simpler nets |
| Dynamic loss scale start | 65536 | halve on inf, double after N clean steps |
| Top-p | 0.9 | with temperature 0.7 for general use |

## Troubleshooting
type: troubleshooting
from: phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss is NaN after a few epochs | softmax overflow or lr too high | stable softmax, lower lr, clip gradients |
| Loss stuck at log(num_classes) | near uniform outputs | check labels, loss function, dead ReLUs |
| Accuracy 1 to 3% low with float16 | gradient underflow | dynamic loss scaling or bfloat16 |
| Gradient norm 0.0 in some layers | dead ReLU or float16 underflow | LeakyReLU or GELU, gradient scaling |
| Results differ across GPUs | float addition is not associative | `torch.use_deterministic_algorithms(True)` |
| `0.1 + 0.2 == 0.3` is False | 0.1 is not exact in binary | `math.isclose()` or a tolerance |
| Solution changes a lot for small input changes | large condition number | add $\lambda I$ or drop collinear features |
| One unseen word zeroes Naive Bayes | MLE gives probability zero | Laplace smoothing, add 1 to counts |

## Questions
type: qa
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/09-information-theory/docs/en.md, phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/16-sampling-methods/docs/en.md

- **Why reverse mode?** Many inputs and one loss. One backward pass gives all gradients.
- **Why cross-entropy?** Minimizing it maximizes the likelihood of the data.
- **Why bfloat16 for training?** It has the float32 range, so values above 65,504 do not overflow.
- **Why SVD and not the eigenvectors of A.T @ A?** That product squares the condition number.
- **Why the reparameterization trick?** $z = \mu + \sigma \epsilon$ lets gradients flow through $\mu$ and $\sigma$.

## Tips
type: tips
from: phases/01-math-foundations/02-vectors-matrices-operations/docs/en.md, phases/01-math-foundations/13-numerical-stability/docs/en.md, phases/01-math-foundations/07-bayes-theorem/docs/en.md, phases/01-math-foundations/09-information-theory/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md

- Check shapes: `(m x n) @ (n x p) = (m x p)`.
- Sum log probabilities. Do not multiply many small probabilities.
- Never compare floats with `==`.
- Check gradients when you write a new layer or loss.
- Perplexity is the exponential of cross-entropy in nats.
- In a gradient check, a relative error below 1e-5 is acceptable.
