---
id: calculus-optimization
title: Calculus, Gradients and Convex Optimization
code: CG
subtitle: Derivatives, autodiff, GD, momentum, Adam, Newton and convexity tests. From-scratch Python and PyTorch.
hue: 30
sources: phases/01-math-foundations/04-calculus-for-ml, phases/01-math-foundations/05-chain-rule-and-autodiff, phases/01-math-foundations/08-optimization, phases/01-math-foundations/18-convex-optimization
source_hash: e8999348285411d1
---

## Forward and backward through one neuron
type: architecture
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md

```arch
node | x | 1,1 | x | input
node | z1 | 2,1 | z1 = w*x | multiply
node | z2 | 3,1 | z2 = w*x + b | add bias
node | a | 4,1 | a = sigmoid(z2) | activation
node | dw | 1,2 | dL/dw | dL/dz2 * x
node | db | 2,2 | dL/db | dL/dz2 * 1
node | dz2 | 3,2 | dL/dz2 | dL/da * a(1-a)
node | loss | 4,2 | L | cross-entropy loss
edge | x | z1 | *w
edge | z1 | z2 | +b
edge | z2 | a |
edge | a | loss |
edge | loss | dz2 | backward
edge | dz2 | dw | x
edge | dz2 | db | 1
```

## Reverse-mode autodiff in Value.backward
type: flow
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/05-chain-rule-and-autodiff/code/autodiff.py

1. **Record**: each operation makes a new `Value` with its children and a `_backward` closure.
2. **Sort**: `build_topo` puts every node after the nodes it depends on.
3. **Seed**: set `self.grad = 1.0` on the output. This is dy/dy = 1.
4. **Walk back**: call `v._backward()` for each node in reversed topological order.
5. **Accumulate**: each closure adds to `.grad` with `+=`. A value used twice gets the sum.
6. **Reset**: set `p.grad = 0.0` for every parameter before the next `loss.backward()`.
7. **Update**: `p.data -= lr * p.grad` for each parameter.

## Tasks in code
type: task-table
from: phases/01-math-foundations/04-calculus-for-ml/code/derivatives.py, phases/01-math-foundations/05-chain-rule-and-autodiff/code/autodiff.py, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/code/optimizers.py, phases/01-math-foundations/18-convex-optimization/code/convex.py

| Task | Code |
|---|---|
| Central difference | `numerical_derivative(f, x, h=1e-7)` |
| Gradient of many inputs | `numerical_gradient(f, point, h=1e-7)` |
| Hessian of f(x, y) | `hessian_2d(f, x, y, h=1e-5)` |
| Check an autodiff gradient | `gradient_check(build_expr, x_val, h=1e-7)` |
| XOR network, 4 hidden | `model = MLP([2, 4, 1])` |
| Run an optimizer | `optimize(optimizer, func, grad_func, start)` |
| Test convexity by sampling | `check_convexity(f, dim)` |
| Newton steps in 2D | `newtons_method(grad_f, hessian_f, x0)` |

## Optimizers from scratch
type: annotated-code
lang: python
from: phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/08-optimization/code/optimizers.py

```python
GradientDescent(lr=0.001)  # w = w - lr * gradient
SGDMomentum(lr=0.001, momentum=0.9)  # v = beta * v + gradient
Adam(lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8)  # two moments per weight
m_hat = [m / (1 - self.beta1 ** self.t) for m in self.m]  # bias correction
p - self.lr * mh / (vh ** 0.5 + self.epsilon)  # per-weight step size
adam_history = optimize(Adam(lr=0.01), rosenbrock, rosenbrock_gradient, start)
```

## Autograd and optimizers in PyTorch
type: annotated-code
lang: python
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md

```python
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2 + 3 * x + 1
y.backward()  # reverse mode through the recorded graph
print(x.grad)  # 7.0 = 2*x + 3
sgd = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
adam = torch.optim.Adam(model.parameters(), lr=0.001)
adamw = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(adam, T_max=100)
```

## Key formulas
type: concepts
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/18-convex-optimization/docs/en.md

- **Central difference**: $f'(x) \approx \frac{f(x + h) - f(x - h)}{2h}$.
- **Chain rule**: $\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$. Sum the paths where the graph branches.
- **Gradient descent**: $w = w - \text{lr} \cdot \text{gradient}$.
- **Momentum**: $v = \beta \cdot v + \text{gradient}$, then $w = w - \text{lr} \cdot v$.
- **Adam**: $w = w - \text{lr} \cdot \hat{m} / (\sqrt{\hat{v}} + \epsilon)$ with bias-corrected moments.
- **Newton**: $x_{\text{new}} = x - H^{-1} \cdot \text{gradient}$.
- **Convex**: $f(tx + (1-t)y) \le t f(x) + (1-t) f(y)$ for $t \in [0, 1]$.
- **Lagrangian**: $L(x, \lambda) = f(x) + \lambda g(x)$. Set its gradient to zero.

## Derivatives to know
type: command-table
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md

| Command | What it does |
|---|---|
| x^2 | 2x. MSE loss |
| wx + b | x for w, 1 for b, w for x. Linear layer |
| e^x | e^x. Softmax, attention |
| ln(x) | 1/x. Cross-entropy loss |
| sigmoid | f(x)(1-f(x)). Sigmoid activation |
| tanh | 1 - tanh^2. Classic activation |
| x^n | n x^(n-1). Used by `__pow__` |
| sin(x^2) | cos(x^2) * 2x. Chain rule example |

## Pick a method
type: command-table
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/18-convex-optimization/docs/en.md

| Command | What it does |
|---|---|
| Gradient descent | First derivatives. O(n) memory. Baseline |
| SGD with momentum | Best final accuracy with more tuning |
| Adam | Diagonal curvature from gradient moments. Deep learning default |
| AdamW | Adam with decoupled weight decay. Transformers |
| Newton's method | Full Hessian. O(n^3) per step. Small convex problems |
| L-BFGS | Last m gradient differences. Medium convex problems |
| K-FAC | Kronecker-factored Fisher. Large-batch training |

## Numbers and defaults
type: defaults
from: phases/01-math-foundations/04-calculus-for-ml/code/derivatives.py, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/08-optimization/code/optimizers.py

| Setting | Default | Note |
|---|---|---|
| Adam `lr` | 0.001 | Start here for most problems |
| Adam `beta2` | 0.999 | `beta1` is 0.9. Moment decay rates |
| Adam `epsilon` | 1e-8 | Stops division by zero |
| SGD momentum `lr` | 0.01 | With momentum 0.9 |
| AdamW `weight_decay` | 0.01 | Decoupled from the gradient step |
| Mini-batch size | 32-256 | Good gradient estimate, moderate noise |
| Finite difference `h` | 1e-7 | In `numerical_derivative` |
| Gradient check difference | < 1e-5 | Autodiff against numerical |

## Troubleshooting
type: troubleshooting
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/18-convex-optimization/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss grows or becomes nan | Learning rate too large | Reduce the learning rate |
| Training is too slow | Learning rate too small | Increase it. Add a schedule |
| Zigzag in a narrow valley | High condition number of the Hessian | Add momentum, or use Newton |
| Gradient near 0, no progress | Saddle point | Momentum and mini-batch noise |
| Gradients grow each step | `.grad` adds with `+=` | Set `p.grad = 0.0` before `backward` |
| Autodiff disagrees with numeric | Bug in a `_backward` rule | Run `gradient_check` |
| Noisy second derivative | Step h too small | Use `h=1e-4` for both calls |
| Newton too costly for a big model | O(n^2) memory, O(n^3) inverse | Use L-BFGS or Adam |

## Questions
type: qa
from: phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/18-convex-optimization/docs/en.md

- **Why reverse mode for networks?** Many inputs and one loss. One backward pass gives all gradients.
- **How do I test convexity?** f'' >= 0 in 1D. Hessian positive semidefinite in many dimensions.
- **Why does SGD work on non-convex losses?** Most critical points are saddle points. Most minima are good.
- **Why does L1 give sparse weights?** The diamond has corners on the axes.
- **What is complementary slackness?** $\lambda_i \, g_i(x) = 0$. Support vectors have $\lambda > 0$.

## Tips
type: tips
from: phases/01-math-foundations/04-calculus-for-ml/docs/en.md, phases/01-math-foundations/05-chain-rule-and-autodiff/docs/en.md, phases/01-math-foundations/08-optimization/docs/en.md, phases/01-math-foundations/18-convex-optimization/docs/en.md

- Use a learning rate schedule for runs longer than a few epochs.
- Cosine annealing and warmup suit transformers and large models.
- Newton's method solves a quadratic in one step.
- Gradient checks cost 2 forward passes per parameter. Do not run them in production training.
- A Hessian with mixed eigenvalue signs at a critical point marks a saddle.
- Flat minima generalize better than sharp minima.
