# Convex Optimization

> Convex problems have one valley. Neural networks have millions. Knowing the difference matters.

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 04 (Calculus for ML), 08 (Optimization)
**Time:** ~90 minutes

## Learning Objectives

- Test whether a function is convex using the definition, second derivative, and Hessian criteria
- Implement Newton's method and compare its quadratic convergence against gradient descent
- Solve constrained optimization problems using Lagrange multipliers and interpret KKT conditions
- Explain why neural network loss landscapes are non-convex yet SGD still finds good solutions

## The Problem

Lesson 08 taught you gradient descent, momentum, and Adam. Those optimizers walk downhill on any surface. But they come with no guarantees. Gradient descent on a non-convex landscape might land in a bad local minimum, get stuck on a saddle point, or oscillate forever. You used it anyway because neural networks are non-convex and there is no alternative.

But many problems in machine learning are convex. Linear regression, logistic regression, SVMs, LASSO, ridge regression. For these, something stronger exists: optimization with mathematical guarantees. A convex problem has exactly one valley. Any algorithm that walks downhill will reach the global minimum. No restarts needed. No learning rate schedules. No prayer.

Understanding convexity does three things. First, it tells you when your problem is easy (convex) versus hard (non-convex). Second, it gives you faster tools like Newton's method for convex problems. Third, it explains concepts that appear throughout ML: regularization as a constraint, duality in SVMs, and why deep learning works despite violating every nice property convexity gives you.

## The Concept

### Convex sets

A set $S$ is convex if for any two points in $S$, the line segment between them also lies entirely in $S$.

| Convex sets | Not convex |
|---|---|
| **Rectangle**: any two points inside can be connected by a line segment that stays inside | **Star/crescent shape**: a line between two interior points can pass outside the set |
| **Triangle**: same property holds for all interior points | **Donut/annulus**: the hole means some line segments leave the set |
| The line segment between any two points stays within the set | The line segment between some pairs of points exits the set |

Formal test: for any points $x, y$ in $S$ and any $t \in [0, 1]$, the point $tx + (1-t)y$ is also in $S$.

Examples of convex sets:
- A line, a plane, all of $\mathbb{R}^n$
- A ball (circle, sphere, hypersphere)
- A halfspace: $\{x : a^T x \leq b\}$
- The intersection of any number of convex sets

Examples of non-convex sets:
- A donut (annulus)
- The union of two disjoint circles
- Any set with a "dent" or "hole"

### Convex functions

A function $f$ is convex if its domain is a convex set and for any two points $x, y$ in its domain and any $t \in [0, 1]$:

$$
f(tx + (1-t)y) \leq t \cdot f(x) + (1-t) \cdot f(y)
$$

Geometrically: the line segment between any two points on the graph lies above or on the graph.

| Property | Convex function | Non-convex function |
|---|---|---|
| **Line segment test** | The line between any two points on the graph lies **above or on** the curve | The line between some points on the graph dips **below** the curve |
| **Shape** | Single bowl/valley curving upward | Multiple peaks and valleys with mixed curvature |
| **Local minima** | Every local minimum is the global minimum | Multiple local minima may exist at different heights |

Common convex functions:
- $f(x) = x^2$ (parabola)
- $f(x) = |x|$ (absolute value)
- $f(x) = e^x$ (exponential)
- $f(x) = \max(0, x)$ (ReLU, though piecewise linear)
- $f(x) = -\log(x)$ for $x > 0$ (negative log)
- Any linear function $f(x) = a^T x + b$ (both convex and concave)

### Testing for convexity

Three practical tests, from easiest to most rigorous.

**Test 1: Second derivative test (1D).** If $f''(x) \geq 0$ for all $x$, then $f$ is convex.

- $f(x) = x^2$: $f''(x) = 2 \geq 0$. Convex.
- $f(x) = x^3$: $f''(x) = 6x$. Negative for $x < 0$. Not convex.
- $f(x) = e^x$: $f''(x) = e^x > 0$. Convex.

**Test 2: Hessian test (multivariate).** If the Hessian matrix $H(x)$ is positive semidefinite for all $x$, then $f$ is convex. The Hessian is the matrix of second partial derivatives.

**Test 3: Definition test.** Check the inequality $f(tx + (1-t)y) \leq t \cdot f(x) + (1-t) \cdot f(y)$ directly. Useful for functions where derivatives are hard to compute.

### Why convexity matters

The central theorem of convex optimization:

**For a convex function, every local minimum is a global minimum.**

This means gradient descent cannot get trapped. Any downhill path leads to the same answer. The algorithm is guaranteed to converge to the optimal solution.

```mermaid
graph LR
    subgraph "Convex: ONE answer"
        direction TB
        C1["Loss surface has a single valley"] --> C2["Gradient descent ALWAYS finds the global minimum"]
    end
    subgraph "Non-convex: MANY traps"
        direction TB
        N1["Loss surface has multiple valleys and peaks"] --> N2["Gradient descent may get stuck in a local minimum"]
        N2 --> N3["Global minimum might be missed"]
    end
```

Consequences:
- No need for random restarts
- No need for sophisticated learning rate schedules
- Convergence proofs are possible (rate depends on function properties)
- The solution is unique (up to flat regions)

### Convex vs non-convex in ML

| Problem | Convex? | Why |
|---------|---------|-----|
| Linear regression (MSE) | Yes | Loss is quadratic in weights |
| Logistic regression | Yes | Log-loss is convex in weights |
| SVM (hinge loss) | Yes | Maximum of linear functions |
| LASSO (L1 regression) | Yes | Sum of convex functions is convex |
| Ridge regression (L2) | Yes | Quadratic + quadratic = convex |
| Neural network (any loss) | No | Nonlinear activations create non-convex landscape |
| k-means clustering | No | Discrete assignment step |
| Matrix factorization | No | Product of unknowns |

Linear models with convex losses are convex. The moment you add hidden layers with nonlinear activations, convexity breaks.

### The Hessian matrix

The Hessian $H$ of a function $f: \mathbb{R}^n \to \mathbb{R}$ is the $n \times n$ matrix of second partial derivatives.

$$
H_{ij} = \frac{\partial^2 f}{\partial x_i \, \partial x_j}
$$

For $f(x, y) = x^2 + 3xy + y^2$:

$$
\begin{aligned}
\frac{\partial f}{\partial x} = 2x + 3y \qquad & \frac{\partial^2 f}{\partial x^2} = 2 \qquad \frac{\partial^2 f}{\partial x \, \partial y} = 3 \\
\frac{\partial f}{\partial y} = 3x + 2y \qquad & \frac{\partial^2 f}{\partial y \, \partial x} = 3 \qquad \frac{\partial^2 f}{\partial y^2} = 2
\end{aligned}
$$

$$
H = \begin{bmatrix} 2 & 3 \\ 3 & 2 \end{bmatrix}
$$

The Hessian tells you about curvature:
- Eigenvalues all positive: the function curves upward in every direction (convex at that point)
- Eigenvalues all negative: curves downward in every direction (concave, a local max)
- Mixed signs: saddle point (curves up in some directions, down in others)
- Zero eigenvalue: flat in that direction (degenerate)

For convexity, the Hessian must be positive semidefinite (all eigenvalues $\geq 0$) everywhere, not just at one point.

### Newton's method

Gradient descent uses first-order information (the gradient). Newton's method uses second-order information (the Hessian). It fits a quadratic approximation at the current point and jumps directly to the minimum of that quadratic.

Update rule:

$$
x_{\text{new}} = x - H^{-1} \cdot \text{gradient}
$$

Compare to gradient descent:

$$
x_{\text{new}} = x - \text{lr} \cdot \text{gradient}
$$

Newton's method replaces the scalar learning rate with the inverse Hessian. This automatically adjusts the step size and direction based on local curvature.

```mermaid
graph TD
    subgraph "Gradient Descent"
        GD1["Start"] --> GD2["Step 1"]
        GD2 --> GD3["Step 2"]
        GD3 --> GD4["..."]
        GD4 --> GD5["Step ~500: Converged"]
        GD_note["Follows gradient blindly — many small steps"]
    end
    subgraph "Newton's Method"
        NM1["Start"] --> NM2["Step 1"]
        NM2 --> NM3["..."]
        NM3 --> NM4["Step ~5: Converged"]
        NM_note["Uses curvature for optimal steps"]
    end
```

Advantages:
- Quadratic convergence near the minimum (error squares each step)
- No learning rate to tune
- Scale-invariant (works regardless of how you parameterize the problem)

Disadvantages:
- Computing the Hessian costs $O(n^2)$ memory and $O(n^3)$ to invert
- For a neural network with 1 million weights, that is $10^{12}$ entries and $10^{18}$ operations
- Not practical for deep learning

### Constrained optimization

Unconstrained optimization: minimize $f(x)$ over all $x$.
Constrained optimization: minimize $f(x)$ subject to constraints.

Real problems have constraints. You want to minimize cost but your budget is limited. You want to minimize error but your model complexity is bounded.

```mermaid
graph LR
    subgraph "Unconstrained"
        U1["Loss function"] --> U2["Free minimum: lowest point of the loss surface"]
    end
    subgraph "Constrained"
        C1["Loss function"] --> C2["Constrained minimum: lowest point within the feasible region"]
        C3["Constraint boundary limits the search space"]
    end
```

### Lagrange multipliers

The method of Lagrange multipliers converts a constrained problem into an unconstrained one.

Problem: minimize $f(x)$ subject to $g(x) = 0$.

Solution: introduce a new variable (the Lagrange multiplier $\lambda$) and solve the unconstrained problem:

$$
L(x, \lambda) = f(x) + \lambda \cdot g(x)
$$

At the solution, the gradient of $L$ is zero:

$$
\begin{aligned}
\frac{\partial L}{\partial x} &= \frac{\partial f}{\partial x} + \lambda \cdot \frac{\partial g}{\partial x} = 0 \\
\frac{\partial L}{\partial \lambda} &= g(x) = 0
\end{aligned}
$$

Geometric intuition: at the constrained minimum, the gradient of $f$ must be parallel to the gradient of the constraint $g$. If they were not parallel, you could move along the constraint surface and reduce $f$ further.

```mermaid
graph LR
    A["Contours of f(x,y): concentric ellipses"] --- S["Solution point"]
    B["Constraint curve g(x,y) = 0"] --- S
    S --- C["At the solution, gradient of f is parallel to gradient of g"]
```

Example: minimize $f(x,y) = x^2 + y^2$ subject to $x + y = 1$.

$$
\begin{aligned}
L &= x^2 + y^2 + \lambda(x + y - 1) \\[4pt]
\frac{\partial L}{\partial x} &= 2x + \lambda = 0 \implies x = -\lambda/2 \\
\frac{\partial L}{\partial y} &= 2y + \lambda = 0 \implies y = -\lambda/2 \\
\frac{\partial L}{\partial \lambda} &= x + y - 1 = 0
\end{aligned}
$$

From the first two: $x = y$. Substituting: $2x = 1$, so $x = y = 0.5$, $\lambda = -1$.

The closest point on the line $x + y = 1$ to the origin is $(0.5, 0.5)$.

### KKT conditions

The Karush-Kuhn-Tucker conditions extend Lagrange multipliers to inequality constraints.

Problem: minimize $f(x)$ subject to $g_i(x) \leq 0$ for $i = 1, \ldots, m$.

The KKT conditions (necessary for optimality):

$$
\begin{aligned}
&\text{1. Stationarity:} && \frac{\partial f}{\partial x} + \sum_i \lambda_i \cdot \frac{\partial g_i}{\partial x} = 0 \\
&\text{2. Primal feasibility:} && g_i(x) \leq 0 \quad \text{for all } i \\
&\text{3. Dual feasibility:} && \lambda_i \geq 0 \quad \text{for all } i \\
&\text{4. Complementary slackness:} && \lambda_i \cdot g_i(x) = 0 \quad \text{for all } i
\end{aligned}
$$

Complementary slackness is the key insight: either the constraint is active ($g_i = 0$, the solution sits on the boundary) or the multiplier is zero (the constraint does not matter). A constraint that does not affect the solution has $\lambda = 0$.

KKT conditions are central to SVMs. The support vectors are the data points where the constraint is active ($\lambda > 0$). All other data points have $\lambda = 0$ and do not affect the decision boundary.

### Regularization as constrained optimization

L1 and L2 regularization are not arbitrary tricks. They are constrained optimization problems in disguise.

**L2 regularization (Ridge):**

$$
\text{minimize } \text{Loss}(w) \quad \text{subject to } \|w\|^2 \leq t
$$

Equivalent unconstrained form:

$$
\text{minimize } \text{Loss}(w) + \lambda \cdot \|w\|^2
$$

The constraint $\|w\|^2 \leq t$ defines a ball (circle in 2D, sphere in 3D). The solution is where the loss contours first touch this ball.

**L1 regularization (LASSO):**

$$
\text{minimize } \text{Loss}(w) \quad \text{subject to } \|w\|_1 \leq t
$$

Equivalent unconstrained form:

$$
\text{minimize } \text{Loss}(w) + \lambda \cdot \|w\|_1
$$

The constraint $\|w\|_1 \leq t$ defines a diamond (rotated square in 2D).

| Property | L2 constraint (circle) | L1 constraint (diamond) |
|---|---|---|
| **Constraint shape** | Circle (sphere in higher dims) | Diamond (rotated square in 2D) |
| **Where loss contour touches** | Smooth boundary — any point on the circle | Corner — aligned with an axis |
| **Solution behavior** | Weights are small but nonzero | Some weights are exactly zero (sparse) |
| **Result** | Weight shrinkage | Feature selection |

This explains why L1 produces sparse models (feature selection) while L2 only shrinks weights. The diamond has corners aligned with axes. Loss contours are more likely to touch a corner, setting one or more weights exactly to zero.

### Duality

Every constrained optimization problem (the primal) has a companion problem (the dual). For convex problems, the primal and dual have the same optimal value. This is strong duality.

The Lagrangian dual function:

$$
\begin{aligned}
\text{Primal:} \quad & \text{minimize } f(x) \text{ subject to } g(x) \leq 0 \\
\text{Lagrangian:} \quad & L(x, \lambda) = f(x) + \lambda \cdot g(x) \\
\text{Dual function:} \quad & d(\lambda) = \min_x L(x, \lambda) \\
\text{Dual problem:} \quad & \text{maximize } d(\lambda) \text{ subject to } \lambda \geq 0
\end{aligned}
$$

Why duality matters:
- The dual problem is sometimes easier to solve than the primal
- SVMs are solved in their dual form, where the problem depends on dot products between data points (enabling the kernel trick)
- The dual provides a lower bound on the primal optimum, useful for checking solution quality

For SVMs specifically:

$$
\begin{aligned}
\text{Primal:} \quad & \text{find } w, b \text{ that maximize the margin } \frac{2}{\|w\|} \text{ subject to} \\
& y_i(w^T x_i + b) \geq 1 \text{ for all } i \\[6pt]
\text{Dual:} \quad & \text{maximize } \sum_i \alpha_i - \tfrac{1}{2} \sum_{ij} \alpha_i \alpha_j y_i y_j \, x_i^T x_j \\
& \text{subject to } \alpha_i \geq 0 \text{ and } \sum_i \alpha_i y_i = 0
\end{aligned}
$$

The dual only involves dot products $x_i^T x_j$. Replace $x_i^T x_j$ with $K(x_i, x_j)$ to get the kernel trick.

### Why deep learning works despite non-convexity

Neural network loss functions are wildly non-convex. By every classical measure, optimizing them should fail. Yet stochastic gradient descent finds good solutions reliably. Several factors explain this.

**Most local minima are good enough.** In high-dimensional spaces, random critical points (where the gradient is zero) are overwhelmingly saddle points, not local minima. The few local minima that exist tend to have loss values close to the global minimum. Getting trapped in a terrible local minimum is extremely unlikely when the parameter space has millions of dimensions.

**Saddle points, not local minima, are the real obstacle.** In a function with $n$ parameters, a saddle point has a mix of positive and negative curvature directions. For a random critical point in high dimensions, the probability of all $n$ eigenvalues being positive (local minimum) is roughly $2^{-n}$. Almost all critical points are saddle points. SGD's noise helps escape them.

**Overparameterization smooths the landscape.** Networks with more parameters than training examples have smoother, more connected loss surfaces. Wider networks have fewer bad local minima. This is counterintuitive but empirically consistent.

**Loss landscape structure:**

| Property | Low-dimensional space | High-dimensional space |
|---|---|---|
| **Landscape** | Many isolated peaks and valleys | Smoothly connected valleys |
| **Minima** | Many isolated local minima | Few bad local minima; most are near-optimal |
| **Navigation** | Hard to find global minimum | Many paths lead to good solutions |
| **Critical points** | Mix of local minima and saddle points | Overwhelmingly saddle points, not local minima |

**Stochastic noise acts as implicit regularization.** Mini-batch SGD adds noise that prevents settling into sharp minima. Sharp minima overfit; flat minima generalize. The noise biases optimization toward flat regions of the loss landscape.

### Second-order methods in practice

Pure Newton's method is impractical for large models. Several approximations make second-order information usable.

**L-BFGS (Limited-memory BFGS):** Approximates the inverse Hessian using the last $m$ gradient differences. Requires $O(mn)$ memory instead of $O(n^2)$. Works well for problems with up to ~10,000 parameters. Used in classical ML (logistic regression, CRFs) but not deep learning.

**Natural gradient:** Uses the Fisher information matrix (expected Hessian of the log-likelihood) instead of the standard Hessian. This accounts for the geometry of probability distributions. K-FAC (Kronecker-Factored Approximate Curvature) approximates the Fisher matrix as a Kronecker product, making it practical for neural networks.

**Hessian-free optimization:** Uses conjugate gradient to solve $Hx = g$ without ever forming $H$. Only requires Hessian-vector products, which can be computed in $O(n)$ time via automatic differentiation.

**Diagonal approximations:** Adam's second moment is a diagonal approximation of the Hessian's diagonal. AdaHessian extends this by using actual Hessian diagonal elements via Hutchinson's estimator.

| Method | Memory | Per-step cost | When to use |
|--------|--------|--------------|-------------|
| Gradient descent | $O(n)$ | $O(n)$ | Baseline, large models |
| Newton's method | $O(n^2)$ | $O(n^3)$ | Small convex problems |
| L-BFGS | $O(mn)$ | $O(mn)$ | Medium convex problems |
| Adam | $O(n)$ | $O(n)$ | Deep learning default |
| K-FAC | $O(n)$ | $O(n)$ per layer | Research, large-batch training |

```figure
convex-vs-nonconvex
```

## Build It

### Step 1: Convexity checker

Build a function that tests convexity empirically by sampling points and checking the definition.

```python
import random
import math

def check_convexity(f, dim, bounds=(-5, 5), samples=1000):
    violations = 0
    for _ in range(samples):
        x = [random.uniform(*bounds) for _ in range(dim)]
        y = [random.uniform(*bounds) for _ in range(dim)]
        t = random.uniform(0, 1)
        mid = [t * xi + (1 - t) * yi for xi, yi in zip(x, y)]
        lhs = f(mid)
        rhs = t * f(x) + (1 - t) * f(y)
        if lhs > rhs + 1e-10:
            violations += 1
    return violations == 0, violations
```

### Step 2: Newton's method for 2D

Implement Newton's method using an explicit Hessian. Compare convergence speed against gradient descent.

```python
def newtons_method(f, grad_f, hessian_f, x0, steps=50, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        H = hessian_f(x)
        det = H[0][0] * H[1][1] - H[0][1] * H[1][0]
        if abs(det) < 1e-15:
            break
        H_inv = [
            [H[1][1] / det, -H[0][1] / det],
            [-H[1][0] / det, H[0][0] / det],
        ]
        dx = [
            H_inv[0][0] * g[0] + H_inv[0][1] * g[1],
            H_inv[1][0] * g[0] + H_inv[1][1] * g[1],
        ]
        x = [x[0] - dx[0], x[1] - dx[1]]
        history.append(x[:])
        if sum(gi ** 2 for gi in g) < tol:
            break
    return history
```

### Step 3: Lagrange multiplier solver

Solve constrained optimization using gradient descent on the Lagrangian.

```python
def lagrange_solve(f_grad, g_val, g_grad, x0, lr=0.01,
                   lr_lambda=0.01, steps=5000):
    x = list(x0)
    lam = 0.0
    history = []
    for _ in range(steps):
        fg = f_grad(x)
        gv = g_val(x)
        gg = g_grad(x)
        x = [
            xi - lr * (fgi + lam * ggi)
            for xi, fgi, ggi in zip(x, fg, gg)
        ]
        lam = lam + lr_lambda * gv
        history.append((x[:], lam, gv))
    return history
```

### Step 4: Compare first-order vs second-order

Run gradient descent and Newton's method on the same quadratic function. Count the steps to convergence.

```python
def quadratic(x):
    return 5 * x[0] ** 2 + x[1] ** 2

def quadratic_grad(x):
    return [10 * x[0], 2 * x[1]]

def quadratic_hessian(x):
    return [[10, 0], [0, 2]]
```

Newton's method will converge in 1 step (it is exact for quadratics). Gradient descent will take hundreds of steps because the eigenvalues of the Hessian differ by a factor of 5, creating an elongated valley.

## Use It

Convexity analysis applies directly when choosing ML models and solvers.

For convex problems (logistic regression, SVMs, LASSO):
- Use dedicated solvers (liblinear, CVXPY, scipy.optimize.minimize with method='L-BFGS-B')
- Expect a unique global solution
- Second-order methods are practical and fast

For non-convex problems (neural networks):
- Use first-order methods (SGD, Adam)
- Accept that the solution depends on initialization and randomness
- Use overparameterization, noise, and learning rate schedules as implicit regularization
- Do not waste time searching for the global minimum. A good local minimum is sufficient.

```python
from scipy.optimize import minimize

result = minimize(
    fun=lambda w: sum((y - X @ w) ** 2) + 0.1 * sum(w ** 2),
    x0=np.zeros(d),
    method='L-BFGS-B',
    jac=lambda w: -2 * X.T @ (y - X @ w) + 0.2 * w,
)
```

For SVMs, the dual formulation lets you use the kernel trick:

```python
from sklearn.svm import SVC

svm = SVC(kernel='rbf', C=1.0)
svm.fit(X_train, y_train)
print(f"Support vectors: {svm.n_support_}")
```

## Exercises

1. **Convexity gallery.** Test these functions for convexity using the checker: $f(x) = x^4$, $f(x) = \sin(x)$, $f(x,y) = x^2 + y^2$, $f(x,y) = xy$, $f(x) = \max(x, 0)$. Explain why each result makes sense.

2. **Newton vs gradient descent race.** Run both methods on $f(x,y) = 50x^2 + y^2$ from the starting point $(10, 10)$. How many steps does each need to reach loss < 1e-10? What happens to gradient descent when the condition number (ratio of largest to smallest Hessian eigenvalue) increases?

3. **Lagrange multiplier geometry.** Minimize $f(x,y) = (x-3)^2 + (y-3)^2$ subject to $x + 2y = 4$. Verify the solution by checking that the gradient of $f$ is parallel to the gradient of $g$ at the solution.

4. **Regularization constraint.** Implement L1-constrained optimization: minimize $(x-3)^2 + (y-2)^2$ subject to $|x| + |y| \leq 1$. Show that the solution has one coordinate equal to zero (sparsity from the diamond constraint).

5. **Hessian eigenvalue analysis.** Compute the Hessian of the Rosenbrock function at (1,1) and at (-1,1). Compute eigenvalues at both points. What do the eigenvalues tell you about the curvature at the minimum versus far from it?

## Key Terms

| Term | What it means |
|------|---------------|
| Convex set | A set where the line segment between any two points in the set stays inside the set |
| Convex function | A function where the line between any two points on its graph lies above or on the graph. Equivalently, Hessian is positive semidefinite everywhere |
| Local minimum | A point lower than all nearby points. For convex functions, every local minimum is the global minimum |
| Global minimum | The lowest point of a function over its entire domain |
| Hessian matrix | The matrix of all second partial derivatives. Encodes curvature information |
| Positive semidefinite | A matrix whose eigenvalues are all non-negative. The multidimensional analogue of "second derivative >= 0" |
| Condition number | Ratio of largest to smallest eigenvalue of the Hessian. High condition number means elongated valleys and slow gradient descent |
| Newton's method | Second-order optimizer that uses the inverse Hessian to determine step direction and size. Quadratic convergence near the minimum |
| Lagrange multiplier | A variable introduced to convert a constrained optimization problem into an unconstrained one |
| KKT conditions | Necessary conditions for optimality with inequality constraints. Generalize Lagrange multipliers |
| Complementary slackness | At the solution, either a constraint is active or its multiplier is zero. Never both nonzero |
| Duality | Every constrained problem has a companion dual problem. For convex problems, both have the same optimal value |
| Strong duality | Primal and dual optimal values are equal. Holds for convex problems satisfying Slater's condition |
| L-BFGS | Approximate second-order method that stores the last m gradient differences instead of the full Hessian |
| Saddle point | A point where the gradient is zero but it is a minimum in some directions and a maximum in others |
| Overparameterization | Using more parameters than training examples. Smooths the loss landscape and reduces bad local minima |

## Further Reading

- [Boyd & Vandenberghe: Convex Optimization](https://web.stanford.edu/~boyd/cvxbook/) - the standard textbook, freely available online
- [Bottou, Curtis, Nocedal: Optimization Methods for Large-Scale Machine Learning (2018)](https://arxiv.org/abs/1606.04838) - bridges convex optimization theory and deep learning practice
- [Choromanska et al.: The Loss Surfaces of Multilayer Networks (2015)](https://arxiv.org/abs/1412.0233) - why non-convex neural network landscapes are not as bad as they seem
- [Nocedal & Wright: Numerical Optimization](https://link.springer.com/book/10.1007/978-0-387-40065-5) - comprehensive reference for Newton's method, L-BFGS, and constrained optimization
