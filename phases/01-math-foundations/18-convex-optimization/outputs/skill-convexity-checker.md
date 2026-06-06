---
name: skill-convexity-checker
description: Determine if an optimization problem is convex and choose the right solver
version: 1.0.0
phase: 1
lesson: 18
tags: [optimization, convexity, solvers]
---

# Convexity Checker

How to verify whether an optimization problem is convex, and what to do with the answer.

## Decision Checklist

1. Is the objective function convex? (Check Hessian positive semi-definiteness or use composition rules.)
2. Are all inequality constraints of the form g_i(x) <= 0 where each g_i is convex?
3. Are all equality constraints affine (linear)?
4. If all three are yes, the problem is convex. Use a convex solver with convergence guarantees.
5. If any are no, the problem is non-convex. Use SGD/Adam and accept local optima.

## How to test convexity of a function

| Test | Applies to | Method |
|---|---|---|
| Second derivative >= 0 | Scalar functions f(x) | Compute f''(x). If f''(x) >= 0 for all x, convex. |
| Hessian is PSD | Multivariate functions f(x) | Compute H(x). If all eigenvalues >= 0 everywhere, convex. |
| Definition test | Any function | Check f(tx + (1-t)y) <= t*f(x) + (1-t)*f(y) for sampled x, y, t. |
| Composition rules | Composed functions | See composition table below. |
| Restriction to a line | Multivariate f | f is convex iff g(t) = f(x + tv) is convex in t for all x, v. |

## Composition rules (preserving convexity)

| Operation | Result |
|---|---|
| f + g (both convex) | Convex |
| c * f (c > 0, f convex) | Convex |
| max(f, g) (both convex) | Convex |
| f(Ax + b) where f is convex | Convex |
| g(f(x)) where g is convex non-decreasing and f is convex | Convex |
| g(f(x)) where g is convex non-increasing and f is concave | Convex |
| sum of convex functions | Convex |
| pointwise supremum of convex functions | Convex |

## Common ML objectives: convex or not?

| Objective | Convex? | Reason |
|---|---|---|
| MSE: (1/n) sum(y - Xw)^2 | Yes | Quadratic in w, Hessian = (2/n) X^T X is PSD |
| Logistic loss: sum(log(1 + exp(-y_i * w^T x_i))) | Yes | Sum of convex functions (log-sum-exp family) |
| Hinge loss: sum(max(0, 1 - y_i * w^T x_i)) | Yes | Max of convex (linear) functions |
| L2 regularization: lambda * \|\|w\|\|^2 | Yes | Quadratic, Hessian = 2*lambda*I |
| L1 regularization: lambda * \|\|w\|\|_1 | Yes | Sum of absolute values (convex but not differentiable) |
| Ridge regression: MSE + L2 | Yes | Sum of two convex functions |
| LASSO: MSE + L1 | Yes | Sum of two convex functions |
| Elastic net: MSE + L1 + L2 | Yes | Sum of convex functions |
| SVM (primal): hinge + L2 | Yes | Sum of convex functions |
| Cross-entropy with softmax | Yes (in logits) | Log-sum-exp is convex |
| Neural network (any loss) | No | Nonlinear activations create non-convex composition |
| k-means objective | No | Discrete assignment step |
| Matrix factorization: \|\|X - UV^T\|\|^2 | No | Bilinear in U and V |
| GAN loss | No | Minimax, non-convex in generator |
| Contrastive loss (InfoNCE) | No | Log of ratio of exponentials with negative samples |

## Solver selection based on convexity

| Problem type | Solver | Convergence guarantee |
|---|---|---|
| Convex, smooth, unconstrained | Gradient descent | O(1/k) to global minimum |
| Convex, smooth, unconstrained | L-BFGS | Superlinear to global minimum |
| Convex, smooth, unconstrained | Newton's method | Quadratic near minimum (if Hessian tractable) |
| Convex, smooth, constrained | Interior point method | Polynomial time |
| Convex, non-smooth (L1) | Proximal gradient / ISTA | O(1/k) to global minimum |
| Convex, non-smooth (L1) | ADMM | Flexible, handles constraints |
| Convex, quadratic | Conjugate gradient | Exact in n steps |
| Non-convex, smooth | SGD / Adam | Converges to local minimum |
| Non-convex, smooth | SGD + restarts | Better local minimum on average |
| Non-convex, smooth | Overparameterize + SGD | Flat minima, good generalization |

## Common mistakes

- Assuming a problem is convex because the loss function is convex. The loss must be convex in the parameters you are optimizing. Cross-entropy is convex in the logits, but the full neural network mapping from inputs to logits is non-convex.
- Using Newton's method on a non-convex problem. The Hessian may have negative eigenvalues, causing Newton to move toward saddle points or maxima instead of minima.
- Forgetting that L1 regularization makes the objective non-differentiable at zero. Standard gradient descent does not work well. Use proximal gradient descent or subgradient methods.
- Squaring the condition number by forming A^T A. If you need to solve a least-squares problem and A is ill-conditioned, use QR or SVD instead of the normal equations.
- Declaring a problem non-convex without checking. Many ML problems (linear models, SVMs, logistic regression) are convex and benefit from stronger solvers.

## Quick test: is my problem convex?

```
1. Write out the objective: minimize f(w) subject to constraints
2. For each term in f(w):
   - Is it quadratic with PSD matrix? -> Convex
   - Is it a norm? -> Convex
   - Is it log-sum-exp? -> Convex
   - Does it involve w nonlinearly (sigmoid(w), w1*w2)? -> Likely non-convex
3. Are all constraints linear or convex inequalities?
4. If ALL terms are convex and constraints are convex/linear -> problem is convex
5. If ANY term is non-convex -> problem is non-convex
```
