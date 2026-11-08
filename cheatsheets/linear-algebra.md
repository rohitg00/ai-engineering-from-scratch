---
id: linear-algebra
title: Linear Algebra for ML
code: LA
subtitle: Vectors, transforms, eigenvalues, SVD and Ax = b solvers. From-scratch Python and NumPy from the lessons.
hue: 230
sources: phases/01-math-foundations/01-linear-algebra-intuition, phases/01-math-foundations/02-vectors-matrices-operations, phases/01-math-foundations/03-matrix-transformations, phases/01-math-foundations/11-singular-value-decomposition, phases/01-math-foundations/17-linear-systems
source_hash: d0fc32de779910f0
---

## SVD: rotate, scale, rotate
type: architecture
from: phases/01-math-foundations/11-singular-value-decomposition/docs/en.md

```arch
node | x | 1,1 | Input space | n-dim
node | vt | 2,1 | V^T | rotate
node | sig | 3,1 | Sigma | scale by sigma_i
node | u | 4,1 | U | rotate
node | ata | 2,2 | A^T A | eigenvectors are V
node | aat | 3,2 | A A^T | eigenvectors are U
node | y | 4,2 | Output space | m-dim
edge | x | vt |
edge | vt | sig |
edge | sig | u |
edge | u | y |
edge | ata | vt | V
edge | aat | u | U
```

## Gaussian elimination with partial pivoting
type: flow
from: phases/01-math-foundations/17-linear-systems/docs/en.md, phases/01-math-foundations/17-linear-systems/code/linear_systems.py

1. **Pivot**: in column k, find the largest entry at or below row k.
2. **Swap**: swap that row with row k. A small pivot amplifies rounding errors.
3. **Check**: a pivot below `1e-12` raises `ValueError`.
4. **Eliminate**: for each row i below k, compute m = A[i][k] / A[k][k]. Subtract m times row k.
5. **Back substitute**: solve the last equation first, then go upward.
6. **Reuse**: L stores the multipliers. U is the eliminated matrix. PA = LU.

## Tasks in NumPy
type: task-table
from: phases/01-math-foundations/01-linear-algebra-intuition/docs/en.md, phases/01-math-foundations/02-vectors-matrices-operations/docs/en.md, phases/01-math-foundations/03-matrix-transformations/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md

| Task | Code |
|---|---|
| Dot product and length | `np.dot(a, b)`, `np.linalg.norm(a)` |
| Matrix multiply | `A @ B` |
| Element-wise multiply | `A * B` |
| Rank | `np.linalg.matrix_rank(A)` |
| Eigenvalues and eigenvectors | `np.linalg.eig(A)` |
| Thin SVD | `np.linalg.svd(A, full_matrices=False)` |
| Least squares | `np.linalg.lstsq(A, b, rcond=None)[0]` |
| QR, check Q | `np.allclose(Q @ Q.T, np.eye(3))` |

## Truncate, compress and invert with SVD
type: annotated-code
lang: python
from: phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/code/svd.py

```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)  # S sorted in decreasing order
A_k = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]  # best rank-k approximation
compressed_size = k * (rows + cols + 1)  # storage for rank k
A_pinv = Vt.T @ np.diag(1.0 / S) @ U.T  # pseudoinverse, nonzero S only
x_svd = A_pinv @ b  # least-squares solution
x_pinv = np.linalg.pinv(A) @ b  # same result from NumPy
U, S, V = svd_from_scratch(A)  # power iteration and deflation
A_pinv = pseudoinverse_via_svd(A, tol=1e-10)  # 1/s only for s above tol
```

## Solve Ax = b from scratch
type: annotated-code
lang: python
from: phases/01-math-foundations/17-linear-systems/docs/en.md, phases/01-math-foundations/17-linear-systems/code/linear_systems.py

```python
x = gaussian_elimination(A, b)  # partial pivoting, O(n^3)
P, L, U = lu_decompose(A)  # PA = LU, pay O(n^3) one time
x = lu_solve(P, L, U, b)  # O(n^2) for each new b
L = cholesky(A)  # A = L L^T, symmetric positive definite only
x = cholesky_solve(L, b)  # forward, then back substitution
w_ols = least_squares_normal(X, y)  # solves A^T A x = A^T b
w_ridge = ridge_regression(X, y, lam=1.0)  # adds lam * np.eye(n)
x, iters = conjugate_gradient(A, b)  # SPD, at most n iterations
kappa = condition_number(A)  # S[0] / S[-1], inf if singular
```

## Transformation matrices
type: command-table
from: phases/01-math-foundations/03-matrix-transformations/docs/en.md, phases/01-math-foundations/03-matrix-transformations/code/transformations.py

| Command | What it does |
|---|---|
| `rotation_2d(theta)` | [[c, -s], [s, c]]. Keeps distances. det 1 |
| `scaling_2d(sx, sy)` | [[sx, 0], [0, sy]]. det is sx * sy |
| `shearing_2d(kx, ky)` | [[1, kx], [ky, 1]]. Rectangles become parallelograms |
| `reflection_y()` | [[-1, 0], [0, 1]]. Flips orientation. det -1 |
| `reflection_x()` | [[1, 0], [0, -1]]. det -1 |
| `mat_mul(S, R)` | Rotate first, then scale. Order matters |
| `eigenvalues_2x2(matrix)` | Roots of the characteristic equation. Complex if discriminant < 0 |
| `eigenvector_2x2(matrix, eigenvalue)` | Unit eigenvector for one eigenvalue |

## Key formulas
type: concepts
from: phases/01-math-foundations/01-linear-algebra-intuition/docs/en.md, phases/01-math-foundations/02-vectors-matrices-operations/docs/en.md, phases/01-math-foundations/03-matrix-transformations/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md

- **Shapes**: (m x n) @ (n x p) = (m x p). The inner dimensions must match.
- **Cosine**: $\cos\theta = \frac{a \cdot b}{\lvert a\rvert \lvert b\rvert}$. 1 is the same direction, 0 is orthogonal.
- **Projection**: $\text{proj}_b a = \frac{a \cdot b}{b \cdot b} b$. The residual is perpendicular to $b$.
- **Eigen**: $Av = \lambda v$. Eigenvalues are roots of $\det(A - \lambda I) = 0$.
- **2x2 eigenvalues**: $\lambda^2 - (a+d)\lambda + (ad - bc) = 0$.
- **SVD**: $A = U \Sigma V^T$ and $A v_i = \sigma_i u_i$. Rank is the count of nonzero $\sigma_i$.
- **Normal equations**: $A^T A x = A^T b$. Ridge adds $\lambda I$ to $A^T A$.
- **Condition number**: $\kappa = \sigma_{\max} / \sigma_{\min}$.

## Pick a solver
type: command-table
from: phases/01-math-foundations/17-linear-systems/docs/en.md

| Command | What it does |
|---|---|
| Gaussian elimination | Square, nonsingular A. O(n^3). One solve |
| LU decomposition | Many solves with the same A. O(n^2) for each solve |
| QR decomposition | Least squares with m >= n. Numerically stable |
| Cholesky | Symmetric positive definite A. Twice as fast as LU |
| Normal equations | Overdetermined, small n. Linear regression |
| SVD / pseudoinverse | Rank-deficient A. Minimum-norm solution |
| Conjugate gradient | Large sparse SPD A. Iterative |

## Numbers and defaults
type: defaults
from: phases/01-math-foundations/01-linear-algebra-intuition/docs/en.md, phases/01-math-foundations/01-linear-algebra-intuition/code/vectors.py, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/code/svd.py, phases/01-math-foundations/17-linear-systems/docs/en.md, phases/01-math-foundations/17-linear-systems/code/linear_systems.py

| Setting | Default | Note |
|---|---|---|
| Zero test in `rank()` | 1e-10 | Smaller entries count as zero |
| Pivot test in elimination | 1e-12 | Smaller pivot raises ValueError |
| `power_iteration` `num_iters` | 200 | Stops early at `tol=1e-10` |
| `conjugate_gradient` `tol` | 1e-10 | `max_iter` defaults to n |
| Safe condition number | < 100 | The solution is accurate |
| Meaningless for float64 | 10^{16} | The matrix is effectively singular |
| Image at rank k=50 | 14.6% | Of the 800 x 600 values |
| LoRA rank | 16 | 131K parameters, not 16M |

## Troubleshooting
type: troubleshooting
from: phases/01-math-foundations/01-linear-algebra-intuition/docs/en.md, phases/01-math-foundations/02-vectors-matrices-operations/docs/en.md, phases/01-math-foundations/03-matrix-transformations/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Shape mismatch error | Inner dimensions differ | Write each shape before you multiply |
| `inverse_2x2` raises ValueError | Determinant is 0 | Use the pseudoinverse |
| "Matrix is not positive definite" | A is not SPD | Add lambda I, or use LU |
| Weights swing on small input changes | Collinear features, rank deficient | Drop features or add regularization |
| Answer loses digits | kappa near 10^k loses k digits | Regularize, or use QR or SVD |
| `np.linalg.eig(A.T @ A)` is imprecise | It squares the condition number | Use `np.linalg.svd(A)` |
| Composition gives the wrong point | B @ A applies A first | Multiply in reverse order of application |
| Gram-Schmidt dots are not exactly 0 | Floating point | Compare with a tolerance such as 1e-9 |

## Questions
type: qa
from: phases/01-math-foundations/03-matrix-transformations/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md

- **Why factor with LU?** The O(n^3) cost is paid one time. Each new b costs O(n^2).
- **When does Cholesky work?** A is symmetric positive definite. $X^T X + \lambda I$ is SPD for $\lambda > 0$.
- **What does the determinant tell you?** The area scale. 0 crushes a dimension. -1 flips orientation.
- **Why is truncated SVD the best rank k?** Eckart-Young. The spectral error is $\sigma_{k+1}$.
- **What do eigenvalues say about stability?** Magnitude above 1 explodes. Below 1 vanishes.

## Tips
type: tips
from: phases/01-math-foundations/01-linear-algebra-intuition/docs/en.md, phases/01-math-foundations/11-singular-value-decomposition/docs/en.md, phases/01-math-foundations/17-linear-systems/docs/en.md

- PCA is SVD on centered data. The components are the right singular vectors V.
- Explained variance for each component is sigma_i^2 / (n-1).
- Look for a clear gap in the singular values. Keep the values above it to denoise.
- Ridge improves the condition number to $(\sigma_{\max} + \lambda) / (\sigma_{\min} + \lambda)$.
- The pseudoinverse gives the solution with the smallest norm when many solutions exist.
- Orthogonal initialization uses QR to make orthonormal weight columns.
