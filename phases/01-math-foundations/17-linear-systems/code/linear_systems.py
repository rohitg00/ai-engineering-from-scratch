import numpy as np


def gaussian_elimination(A, b):
    n = len(b)
    Ab = np.hstack([A.astype(float), b.reshape(-1, 1).astype(float)])

    for k in range(n):
        max_row = k + np.argmax(np.abs(Ab[k:, k]))
        Ab[[k, max_row]] = Ab[[max_row, k]]

        if abs(Ab[k, k]) < 1e-12:
            raise ValueError(f"Matrix is singular at pivot {k}")

        for i in range(k + 1, n):
            m = Ab[i, k] / Ab[k, k]
            Ab[i, k:] -= m * Ab[k, k:]

    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (Ab[i, -1] - Ab[i, i + 1 : n] @ x[i + 1 : n]) / Ab[i, i]

    return x


def lu_decompose(A):
    n = A.shape[0]
    L = np.eye(n)
    U = A.astype(float).copy()
    P = np.eye(n)

    for k in range(n):
        max_row = k + np.argmax(np.abs(U[k:, k]))
        if max_row != k:
            U[[k, max_row]] = U[[max_row, k]]
            P[[k, max_row]] = P[[max_row, k]]
            if k > 0:
                L[[k, max_row], :k] = L[[max_row, k], :k]

        for i in range(k + 1, n):
            L[i, k] = U[i, k] / U[k, k]
            U[i, k:] -= L[i, k] * U[k, k:]

    return P, L, U


def lu_solve(P, L, U, b):
    n = len(b)
    Pb = P @ b.astype(float)

    y = np.zeros(n)
    for i in range(n):
        y[i] = Pb[i] - L[i, :i] @ y[:i]

    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - U[i, i + 1 :] @ x[i + 1 :]) / U[i, i]

    return x


def cholesky(A):
    n = A.shape[0]
    L = np.zeros_like(A, dtype=float)

    for i in range(n):
        for j in range(i + 1):
            s = A[i, j] - L[i, :j] @ L[j, :j]
            if i == j:
                if s <= 0:
                    raise ValueError("Matrix is not positive definite")
                L[i, j] = np.sqrt(s)
            else:
                L[i, j] = s / L[j, j]

    return L


def cholesky_solve(L, b):
    n = len(b)
    y = np.zeros(n)
    for i in range(n):
        y[i] = (b[i] - L[i, :i] @ y[:i]) / L[i, i]

    x = np.zeros(n)
    Lt = L.T
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - Lt[i, i + 1 :] @ x[i + 1 :]) / Lt[i, i]

    return x


def least_squares_normal(A, b):
    AtA = A.T @ A
    Atb = A.T @ b
    return gaussian_elimination(AtA, Atb)


def ridge_regression(A, b, lam):
    n = A.shape[1]
    AtA = A.T @ A + lam * np.eye(n)
    Atb = A.T @ b
    L = cholesky(AtA)
    return cholesky_solve(L, Atb)


def condition_number(A):
    _, S, _ = np.linalg.svd(A)
    if S[-1] < 1e-15:
        return float("inf")
    return S[0] / S[-1]


def conjugate_gradient(A, b, tol=1e-10, max_iter=None):
    n = len(b)
    if max_iter is None:
        max_iter = n

    x = np.zeros(n)
    r = b.astype(float) - A @ x
    p = r.copy()
    rs_old = r @ r

    for k in range(max_iter):
        Ap = A @ p
        alpha = rs_old / (p @ Ap)
        x = x + alpha * p
        r = r - alpha * Ap
        rs_new = r @ r
        if np.sqrt(rs_new) < tol:
            return x, k + 1
        beta = rs_new / rs_old
        p = r + beta * p
        rs_old = rs_new

    return x, max_iter


def demo_gaussian_elimination():
    print("=" * 60)
    print("Gaussian Elimination with Partial Pivoting")
    print("=" * 60)

    A = np.array([[2, 1, 1], [4, 3, 3], [2, 3, 1]], dtype=float)
    b = np.array([8, 20, 12], dtype=float)

    x_ours = gaussian_elimination(A, b)
    x_numpy = np.linalg.solve(A, b)

    print(f"A =\n{A}")
    print(f"b = {b}")
    print(f"Solution (ours):  {x_ours}")
    print(f"Solution (numpy): {x_numpy}")
    print(f"Max difference: {np.max(np.abs(x_ours - x_numpy)):.2e}")

    residual = A @ x_ours - b
    print(f"Residual ||Ax - b||: {np.linalg.norm(residual):.2e}")
    print()


def demo_lu():
    print("=" * 60)
    print("LU Decomposition")
    print("=" * 60)

    A = np.array([[2, 1, 1], [4, 3, 3], [2, 3, 1]], dtype=float)
    b = np.array([8, 20, 12], dtype=float)

    P, L, U = lu_decompose(A)

    print(f"P =\n{P}")
    print(f"L =\n{L}")
    print(f"U =\n{U}")

    reconstructed = P.T @ L @ U
    print(f"PA = LU reconstruction error: {np.max(np.abs(A - reconstructed)):.2e}")

    x = lu_solve(P, L, U, b)
    print(f"Solution: {x}")

    print("\nSolving 3 different right-hand sides with the same LU:")
    for b_i in [np.array([1, 0, 0.0]), np.array([0, 1, 0.0]), np.array([0, 0, 1.0])]:
        x_i = lu_solve(P, L, U, b_i)
        print(f"  b = {b_i} -> x = {np.round(x_i, 4)}")
    print()


def demo_cholesky():
    print("=" * 60)
    print("Cholesky Decomposition")
    print("=" * 60)

    A = np.array([[4, 2, 1], [2, 5, 3], [1, 3, 6]], dtype=float)

    L = cholesky(A)
    print(f"A =\n{A}")
    print(f"L =\n{np.round(L, 4)}")
    print(f"L @ L^T =\n{np.round(L @ L.T, 4)}")
    print(f"Reconstruction error: {np.max(np.abs(A - L @ L.T)):.2e}")

    L_numpy = np.linalg.cholesky(A)
    print(f"Max diff from numpy cholesky: {np.max(np.abs(L - L_numpy)):.2e}")

    b = np.array([7, 10, 10], dtype=float)
    x = cholesky_solve(L, b)
    x_direct = np.linalg.solve(A, b)
    print(f"\nSolve Ax = b:")
    print(f"  x (ours):  {np.round(x, 4)}")
    print(f"  x (numpy): {np.round(x_direct, 4)}")

    print("\nLog determinant via Cholesky:")
    log_det = 2 * np.sum(np.log(np.diag(L)))
    log_det_np = np.log(np.linalg.det(A))
    print(f"  2 * sum(log(diag(L))) = {log_det:.6f}")
    print(f"  log(det(A))           = {log_det_np:.6f}")
    print()


def demo_least_squares():
    print("=" * 60)
    print("Least Squares = Linear Regression")
    print("=" * 60)

    np.random.seed(42)
    n_samples = 100
    n_features = 3
    w_true = np.array([2.0, -1.0, 0.5])

    X_raw = np.random.randn(n_samples, n_features)
    noise = np.random.randn(n_samples) * 0.1
    y = X_raw @ w_true + noise

    X = np.column_stack([np.ones(n_samples), X_raw])
    w_true_with_bias = np.array([0.0, 2.0, -1.0, 0.5])

    w_ols = least_squares_normal(X, y)
    w_numpy = np.linalg.lstsq(X, y, rcond=None)[0]

    print(f"True weights:          {w_true_with_bias}")
    print(f"OLS weights (ours):    {np.round(w_ols, 4)}")
    print(f"OLS weights (numpy):   {np.round(w_numpy, 4)}")
    print(f"Max difference: {np.max(np.abs(w_ols - w_numpy)):.2e}")

    residual = X @ w_ols - y
    print(f"Residual norm: {np.linalg.norm(residual):.4f}")
    print()


def demo_ridge():
    print("=" * 60)
    print("Ridge Regression (Regularized Least Squares)")
    print("=" * 60)

    np.random.seed(42)
    n_samples = 100
    n_features = 3
    w_true = np.array([2.0, -1.0, 0.5])

    X_raw = np.random.randn(n_samples, n_features)
    noise = np.random.randn(n_samples) * 0.1
    y = X_raw @ w_true + noise

    X = np.column_stack([np.ones(n_samples), X_raw])

    for lam in [0.0, 0.1, 1.0, 10.0]:
        if lam == 0.0:
            w = least_squares_normal(X, y)
        else:
            w = ridge_regression(X, y, lam)
        r = np.linalg.norm(X @ w - y)
        wnorm = np.linalg.norm(w)
        print(f"lambda={lam:>5.1f}  w={np.round(w, 3)}  ||w||={wnorm:.3f}  ||Xw-y||={r:.3f}")

    try:
        from sklearn.linear_model import Ridge

        print("\nCompare with sklearn Ridge:")
        for lam in [0.1, 1.0, 10.0]:
            w_ours = ridge_regression(X, y, lam)
            ridge_sk = Ridge(alpha=lam, fit_intercept=False)
            ridge_sk.fit(X, y)
            diff = np.max(np.abs(w_ours - ridge_sk.coef_))
            print(f"  lambda={lam:>5.1f}  max diff from sklearn: {diff:.2e}")
    except ImportError:
        print("\nInstall scikit-learn for sklearn comparison: pip install scikit-learn")
    print()


def demo_condition_number():
    print("=" * 60)
    print("Condition Number")
    print("=" * 60)

    A_good = np.array([[2, 0], [0, 1]], dtype=float)
    print(f"Well-conditioned: kappa = {condition_number(A_good):.1f}")

    A_bad = np.array([[1, 1], [1, 1 + 1e-10]], dtype=float)
    print(f"Ill-conditioned:  kappa = {condition_number(A_bad):.2e}")

    np.random.seed(42)
    X = np.random.randn(100, 5)
    print(f"\nRandom 100x5 matrix:")
    print(f"  kappa(X)     = {condition_number(X):.2f}")
    print(f"  kappa(X^T X) = {condition_number(X.T @ X):.2f}")

    X_collinear = X.copy()
    X_collinear[:, 4] = X_collinear[:, 0] + 1e-8 * np.random.randn(100)
    print(f"\nWith near-collinear feature:")
    print(f"  kappa(X)     = {condition_number(X_collinear):.2e}")
    print(f"  kappa(X^T X) = {condition_number(X_collinear.T @ X_collinear):.2e}")

    lam = 0.01
    XtX_reg = X_collinear.T @ X_collinear + lam * np.eye(5)
    print(f"\nAfter regularization (lambda={lam}):")
    print(f"  kappa(X^T X + lambda I) = {condition_number(XtX_reg):.2f}")
    print()


def demo_conjugate_gradient():
    print("=" * 60)
    print("Conjugate Gradient")
    print("=" * 60)

    np.random.seed(42)
    n = 50
    M = np.random.randn(n, n)
    A = M.T @ M + 0.1 * np.eye(n)
    b = np.random.randn(n)

    x_cg, iters = conjugate_gradient(A, b, tol=1e-10)
    x_direct = np.linalg.solve(A, b)

    print(f"System size: {n}")
    print(f"CG iterations: {iters} (max possible: {n})")
    print(f"Max diff from direct solve: {np.max(np.abs(x_cg - x_direct)):.2e}")
    print(f"Residual norm: {np.linalg.norm(A @ x_cg - b):.2e}")
    print(f"Condition number: {condition_number(A):.2f}")

    A_well = np.eye(n) + 0.1 * M.T @ M / n
    b_well = np.random.randn(n)
    x_cg2, iters2 = conjugate_gradient(A_well, b_well, tol=1e-10)
    print(f"\nBetter-conditioned system:")
    print(f"  kappa = {condition_number(A_well):.2f}")
    print(f"  CG iterations: {iters2}")
    print()


def demo_equivalence():
    print("=" * 60)
    print("All Methods Agree: Gaussian, LU, Cholesky, Normal Eq, NumPy")
    print("=" * 60)

    np.random.seed(42)
    n = 5
    M = np.random.randn(n, n)
    A = M.T @ M + np.eye(n)
    b = np.random.randn(n)

    x_gauss = gaussian_elimination(A, b)

    P, L, U = lu_decompose(A)
    x_lu = lu_solve(P, L, U, b)

    Lc = cholesky(A)
    x_chol = cholesky_solve(Lc, b)

    x_numpy = np.linalg.solve(A, b)

    x_cg, _ = conjugate_gradient(A, b, tol=1e-12)

    print(f"Gaussian:  {np.round(x_gauss, 6)}")
    print(f"LU:        {np.round(x_lu, 6)}")
    print(f"Cholesky:  {np.round(x_chol, 6)}")
    print(f"NumPy:     {np.round(x_numpy, 6)}")
    print(f"CG:        {np.round(x_cg, 6)}")
    print(f"\nAll within tolerance:")
    for name, x in [("LU", x_lu), ("Cholesky", x_chol), ("NumPy", x_numpy), ("CG", x_cg)]:
        print(f"  Gaussian vs {name:>10s}: {np.max(np.abs(x_gauss - x)):.2e}")
    print()


def demo_linear_regression_full():
    print("=" * 60)
    print("Full Pipeline: Linear Regression from Scratch")
    print("=" * 60)

    np.random.seed(0)
    n_samples = 200
    x1 = np.random.uniform(0, 10, n_samples)
    x2 = np.random.uniform(0, 5, n_samples)
    noise = np.random.randn(n_samples) * 0.5
    y = 3.0 * x1 - 2.0 * x2 + 7.0 + noise

    X = np.column_stack([np.ones(n_samples), x1, x2])

    print(f"Data: {n_samples} samples, {X.shape[1]} features (with intercept)")
    print(f"True weights: [7.0, 3.0, -2.0]")
    print(f"Condition number of X^T X: {condition_number(X.T @ X):.2f}")

    w_normal = least_squares_normal(X, y)
    print(f"\nNormal equations:     {np.round(w_normal, 4)}")

    AtA = X.T @ X
    Lc = cholesky(AtA)
    w_chol = cholesky_solve(Lc, X.T @ y)
    print(f"Cholesky:             {np.round(w_chol, 4)}")

    w_numpy = np.linalg.lstsq(X, y, rcond=None)[0]
    print(f"NumPy lstsq:          {np.round(w_numpy, 4)}")

    try:
        from sklearn.linear_model import LinearRegression

        lr = LinearRegression(fit_intercept=False)
        lr.fit(X, y)
        print(f"sklearn:              {np.round(lr.coef_, 4)}")
    except ImportError:
        print("sklearn:              (install scikit-learn for comparison)")

    y_pred = X @ w_normal
    mse = np.mean((y - y_pred) ** 2)
    r2 = 1 - np.sum((y - y_pred) ** 2) / np.sum((y - np.mean(y)) ** 2)
    print(f"\nMSE:  {mse:.4f}")
    print(f"R^2:  {r2:.4f}")
    print()


if __name__ == "__main__":
    demo_gaussian_elimination()
    demo_lu()
    demo_cholesky()
    demo_least_squares()
    demo_ridge()
    demo_condition_number()
    demo_conjugate_gradient()
    demo_equivalence()
    demo_linear_regression_full()
