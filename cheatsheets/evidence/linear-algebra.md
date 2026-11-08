# Evidence: cheatsheets/linear-algebra.md

Abbreviations: P = phases/01-math-foundations. L01 = P/01-linear-algebra-intuition, L02 = P/02-vectors-matrices-operations, L03 = P/03-matrix-transformations, L11 = P/11-singular-value-decomposition, L17 = P/17-linear-systems. d = docs/en.md. L01/v = code/vectors.py, L03/t = code/transformations.py, L11/s = code/svd.py, L17/c = code/linear_systems.py.

## SVD: rotate, scale, rotate (architecture, 7 nodes, 6 edges)
- Input space n-dim: L11/d:34, 40
- V^T rotate: L11/d:34, 40
- Sigma scales along each axis, singular values sigma_i: L11/d:35, 57, 77-80
- U rotates: L11/d:36, 41
- Output space m-dim: L11/d:36, 41
- A^T A eigenvectors are V: L11/d:121
- A A^T eigenvectors are U: L11/d:129
- Edges follow the order V^T, Sigma, U: L11/d:27, 44

## Gaussian elimination with partial pivoting (flow, 6 steps)
1. Largest entry in column k at or below row k: L17/d:88
2. Swap with row k, small pivot amplifies rounding errors: L17/d:89, 118
3. Pivot below 1e-12 raises ValueError: L17/c:12-13
4. m = A[i][k] / A[k][k], subtract m times row k: L17/d:90-92
5. Back substitute from the last equation upward: L17/d:93
6. L stores multipliers, U is eliminated matrix, PA = LU: L17/d:139, 163

## Tasks in NumPy (task-table, 8 rows)
- np.dot(a, b), np.linalg.norm(a): L01/d:374-375
- A @ B: L02/d:284
- A * B element-wise: L02/d:283
- np.linalg.matrix_rank(A): L01/d:389
- np.linalg.eig(A): L03/d:386
- np.linalg.svd(A, full_matrices=False): L11/d:426
- np.linalg.lstsq(A, b, rcond=None)[0]: L11/d:484
- np.allclose(Q @ Q.T, np.eye(3)): L01/d:396-397

## Truncate, compress and invert with SVD (annotated-code, 8 lines)
- np.linalg.svd(A, full_matrices=False), sorted in decreasing order: L11/d:62, 479
- U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :], best rank-k (Eckart-Young): L11/d:140, 440
- compressed_size = k * (rows + cols + 1): L11/d:451
- A_pinv = Vt.T @ S_inv @ U.T with S_inv = np.diag(1.0 / S): L11/d:480-481
- x_svd = A_pinv @ b, least squares: L11/d:299, 483
- x_pinv = np.linalg.pinv(A) @ b: L11/d:485
- svd_from_scratch(A) returns U, S, V with power iteration and deflation: L11/d:368, L11/s:24, 59
- pseudoinverse_via_svd(A, tol=1e-10), 1/s if s > tol: L11/s:77-80

## Solve Ax = b from scratch (annotated-code, 9 lines)
- gaussian_elimination(A, b), O(n^3): L17/c:4, L17/d:114
- lu_decompose(A) returns P, L, U, PA = LU: L17/c:26, L17/d:163, 450
- lu_solve(P, L, U, b), O(n^2) per new b: L17/c:47, L17/d:149, 161
- cholesky(A), A = L L^T, SPD only: L17/c:62, L17/d:203
- cholesky_solve(L, b), forward then back substitution: L17/c:79-90
- w_ols = least_squares_normal(X, y), normal equations: L17/d:490-493, 529
- w_ridge = ridge_regression(X, y, lam=1.0), lam * np.eye(n): L17/d:497, 536
- conjugate_gradient(A, b) returns x and k + 1, at most n iterations: L17/c:114-137, L17/d:343
- condition_number(A) returns S[0] / S[-1], inf when S[-1] < 1e-15: L17/c:107-111

## Transformation matrices (command-table, 8 rows)
- rotation_2d(theta) [[c, -s], [s, c]], preserves distances, det 1: L03/d:240-242, 452
- scaling_2d(sx, sy), det sx * sy: L03/d:244-245, 224
- shearing_2d(kx, ky) [[1, kx], [ky, 1]], parallelograms: L03/d:100, 247-248
- reflection_y() [[-1, 0], [0, 1]], det -1: L03/d:221, 253-254
- reflection_x() [[1, 0], [0, -1]]: L03/d:250-251, 455
- mat_mul(S, R) is rotate then scale: L03/d:292
- eigenvalues_2x2(matrix), complex when discriminant < 0: L03/d:306-318
- eigenvector_2x2(matrix, eigenvalue), normalized: L03/d:322-335

## Key formulas (concepts, 8 bullets)
- (m x n) @ (n x p) = (m x p): L02/d:56
- Cosine formula, 1 same direction, 0 orthogonal: L01/d:485
- Projection, residual perpendicular: L01/d:129, 488
- Av = lambda v, det(A - lambda I) = 0: L03/d:174, 461
- 2x2 characteristic equation: L03/d:306
- A = U Sigma V^T, A v_i = sigma_i u_i, rank = count of nonzero singular values: L11/d:52, 77, 544
- Normal equations, ridge adds lambda I: L17/d:238, 276
- kappa = sigma_max / sigma_min: L17/d:318

## Pick a solver (command-table, 7 rows)
- Gaussian elimination: L17/d:372
- LU decomposition: L17/d:373
- QR decomposition: L17/d:374
- Cholesky, twice as fast as LU: L17/d:215, 375
- Normal equations: L17/d:376
- SVD / pseudoinverse: L17/d:377
- Conjugate gradient: L17/d:378

## Numbers and defaults (defaults, 8 rows)
- rank() zero test 1e-10: L01/v:109-116
- Pivot test 1e-12 raises ValueError: L17/c:12-13
- power_iteration num_iters=200, tol=1e-10: L11/s:4, 15-17
- conjugate_gradient tol=1e-10, max_iter = n: L17/c:114-117
- kappa < 100 safe: L17/d:333
- kappa near 10^{16} for float64 meaningless: L17/d:335
- k=50 gives 14.6% of 800 x 600: L11/d:176, 185
- LoRA rank 16, 131K vs 16M parameters: L01/d:441

## Troubleshooting (troubleshooting, 8 rows)
- Shape mismatch from inner dimensions: L02/d:56-65, L02/d:331
- inverse_2x2 raises ValueError when determinant is 0: L02/d:215-216, 327
- "Matrix is not positive definite", add lambda I: L17/d:281, 479
- Collinear features cause unstable weights: L01/d:89, L17/d:394
- kappa near 10^k loses k digits, QR or SVD: L17/d:334, 384
- eig(A.T @ A) squares the condition number, use np.linalg.svd(A): L11/d:317, 332
- B @ A applies A first: L03/d:147, 456
- Tolerance such as 1e-9 for Gram-Schmidt checks: L01/d:460

## Questions (qa, 5 bullets)
- LU: O(n^3) once, O(n^2) per solve: L17/d:161
- Cholesky for SPD, X^T X + lambda I SPD for lambda > 0: L17/d:203, 281
- Determinant: area scale, 0 crushed, -1 flipped: L03/d:215-221
- Eckart-Young, spectral error sigma_{k+1}: L11/d:140, 149
- Eigenvalue magnitude above 1 explodes, below 1 vanishes: L03/d:209

## Tips (tips, 6 bullets)
- PCA is SVD on centered data, components are V: L11/d:336, 351
- Explained variance sigma_i^2 / (n-1): L11/d:352
- Gap in singular values, keep above it: L11/d:273-276
- Ridge condition number formula: L17/d:337
- Pseudoinverse gives smallest norm solution: L17/d:306-309
- Orthogonal initialization with QR: L17/d:390
