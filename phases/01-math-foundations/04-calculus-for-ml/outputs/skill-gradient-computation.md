---
name: skill-gradient-computation
description: Compute gradients of common ML loss functions and choose the right derivative approach
version: 1.0.0
phase: 1
lesson: 4
tags: [calculus, gradients, backpropagation]
---

# Gradient Computation for ML

Practical reference for computing gradients of loss functions, activation functions, and layer operations used in neural networks.

## Decision Checklist

1. Is the function composed of simple primitives (power, exp, log, trig)? Use analytical derivatives and the chain rule.
2. Is the function a custom or black-box operation? Use numerical differentiation: `(f(x+h) - f(x-h)) / (2h)` with h = 1e-7.
3. Is the function built from tensor operations in PyTorch/JAX? Let autograd handle it. Verify with numerical check.
4. Do you need the gradient of a scalar loss w.r.t. a matrix of weights? Apply the chain rule through the computation graph, one node at a time.
5. Is there a non-differentiable operation (argmax, rounding, sampling)? Use a straight-through estimator or reparameterization trick.

## When to use each approach

| Approach | When to use | Cost |
|---|---|---|
| Analytical (hand-derived) | Simple functions, verifying autograd output | Free at runtime |
| Numerical (finite differences) | Debugging, gradient checking, black-box functions | 2n forward passes for n parameters |
| Automatic differentiation | Any differentiable computation graph (the default) | One backward pass |
| Symbolic (SymPy, Mathematica) | Deriving closed-form gradients for papers | Compile time only |

## Quick reference: common derivatives

| Function | f(x) | f'(x) | ML context |
|---|---|---|---|
| MSE loss | (1/n) sum(y_hat - y)^2 | (2/n)(y_hat - y) | Regression |
| Cross-entropy (binary) | -(y log(p) + (1-y) log(1-p)) | p - y (after sigmoid) | Binary classification |
| Cross-entropy (multi) | -log(p_true_class) | p - one_hot(y) (after softmax) | Multi-class classification |
| Sigmoid | 1 / (1 + e^(-x)) | sigma(x) * (1 - sigma(x)) | Output gates, binary output |
| Tanh | (e^x - e^(-x)) / (e^x + e^(-x)) | 1 - tanh(x)^2 | Hidden activations (legacy) |
| ReLU | max(0, x) | 1 if x > 0, 0 if x < 0 | Default hidden activation |
| Leaky ReLU | max(0.01x, x) | 1 if x > 0, 0.01 if x < 0 | Avoiding dead neurons |
| GELU | x * Phi(x) | Phi(x) + x * phi(x) | Transformers |
| Softmax_i | e^(x_i) / sum(e^(x_j)) | s_i(1 - s_i) for i=j, -s_i*s_j for i!=j | Output layer (Jacobian) |
| Log-softmax | x_i - log(sum(e^(x_j))) | 1 - softmax(x_i) for the i-th entry | Numerically stable CE |
| Linear layer | y = Wx + b | dL/dW = dL/dy * x^T, dL/db = dL/dy | Every layer |
| L2 regularization | lambda * sum(w^2) | 2 * lambda * w | Weight decay |
| L1 regularization | lambda * sum(\|w\|) | lambda * sign(w) | Sparsity |

## Common mistakes

- Forgetting the 1/n factor in batch-averaged losses (MSE, cross-entropy). The gradient is scaled by batch size.
- Computing softmax gradient as a vector when it is actually a Jacobian matrix. For cross-entropy + softmax combined, the gradient simplifies to (p - y), which avoids the full Jacobian.
- Applying the chain rule in the wrong order. Work backward from the loss: dL/dW = dL/dy * dy/dW.
- Using h that is too large (h = 0.1) or too small (h = 1e-15) for numerical derivatives. Stick to h = 1e-7 for float64.
- Forgetting that ReLU has undefined gradient at exactly x = 0. In practice, set it to 0 or 0.5.

## Gradient checking recipe

```
For each parameter w:
  numeric_grad = (loss(w + h) - loss(w - h)) / (2h)
  auto_grad = backward pass value
  relative_error = |numeric - auto| / max(|numeric|, |auto|, 1e-8)
  assert relative_error < 1e-5
```

Relative error above 1e-3 means something is wrong. Between 1e-5 and 1e-3, investigate.
