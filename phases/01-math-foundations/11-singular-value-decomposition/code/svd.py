import numpy as np


def power_iteration(M, num_iters=200, tol=1e-10):
    n = M.shape[1]
    v = np.random.randn(n)
    v = v / np.linalg.norm(v)

    for _ in range(num_iters):
        Mv = M @ v
        norm = np.linalg.norm(Mv)
        if norm < tol:
            return 0.0, v
        v_new = Mv / norm
        if np.abs(np.dot(v_new, v)) > 1 - tol:
            v = v_new
            break
        v = v_new

    eigenvalue = v @ M @ v
    return eigenvalue, v


def svd_from_scratch(A, k=None):
    m, n = A.shape
    if k is None:
        k = min(m, n)

    sigmas = []
    us = []
    vs = []

    A_residual = A.copy().astype(float)

    for i in range(k):
        AtA = A_residual.T @ A_residual
        eigenvalue, v = power_iteration(AtA, num_iters=300)

        if eigenvalue < 1e-10:
            break

        sigma = np.sqrt(max(eigenvalue, 0))
        u = A_residual @ v / sigma

        u_norm = np.linalg.norm(u)
        if u_norm > 1e-10:
            u = u / u_norm

        sigmas.append(sigma)
        us.append(u)
        vs.append(v)

        A_residual = A_residual - sigma * np.outer(u, v)

    U = np.column_stack(us) if us else np.empty((m, 0))
    S = np.array(sigmas)
    V = np.column_stack(vs) if vs else np.empty((n, 0))

    return U, S, V


def truncated_svd(A, k):
    U, S, Vt = np.linalg.svd(A, full_matrices=False)
    return U[:, :k], S[:k], Vt[:k, :]


def reconstruct(U, S, Vt):
    return U @ np.diag(S) @ Vt


def compression_ratio(m, n, k):
    original = m * n
    compressed = k * (m + n + 1)
    return compressed / original


def pseudoinverse_via_svd(A, tol=1e-10):
    U, S, Vt = np.linalg.svd(A, full_matrices=False)
    S_inv = np.array([1.0 / s if s > tol else 0.0 for s in S])
    return Vt.T @ np.diag(S_inv) @ U.T


def demo_svd_basics():
    print("=" * 70)
    print("SVD FROM SCRATCH vs NUMPY")
    print("=" * 70)

    np.random.seed(42)
    A = np.random.randn(6, 4)

    print(f"\nMatrix A shape: {A.shape}")
    print(f"Matrix A:\n{np.round(A, 4)}")

    U_ours, S_ours, V_ours = svd_from_scratch(A)
    U_np, S_np, Vt_np = np.linalg.svd(A, full_matrices=False)

    print(f"\nOur singular values:   {np.round(S_ours, 4)}")
    print(f"NumPy singular values: {np.round(S_np, 4)}")

    A_ours = U_ours @ np.diag(S_ours) @ V_ours.T
    A_np = U_np @ np.diag(S_np) @ Vt_np

    err_ours = np.linalg.norm(A - A_ours)
    err_np = np.linalg.norm(A - A_np)
    print(f"\nReconstruction error (ours):  {err_ours:.10f}")
    print(f"Reconstruction error (NumPy): {err_np:.10f}")

    print("\nVerifying A @ v_i = sigma_i * u_i:")
    for i in range(min(4, len(S_np))):
        v_i = Vt_np[i]
        u_i = U_np[:, i]
        lhs = A @ v_i
        rhs = S_np[i] * u_i
        match = np.allclose(lhs, rhs, atol=1e-10) or np.allclose(lhs, -rhs, atol=1e-10)
        print(f"  i={i}: sigma={S_np[i]:.4f}, match={match}")

    print()


def demo_geometry():
    print("=" * 70)
    print("SVD GEOMETRY: ROTATE, SCALE, ROTATE")
    print("=" * 70)

    A = np.array([[3.0, 1.0],
                  [1.0, 3.0]])

    U, S, Vt = np.linalg.svd(A)

    print(f"\nMatrix A:\n{A}")
    print(f"\nU (left rotation):\n{np.round(U, 4)}")
    print(f"Sigma (scaling): {np.round(S, 4)}")
    print(f"V^T (right rotation):\n{np.round(Vt, 4)}")

    print("\nVerify U is orthogonal (U^T U = I):")
    print(f"  {np.round(U.T @ U, 6)}")

    print("Verify V is orthogonal (V^T V = I):")
    print(f"  {np.round(Vt @ Vt.T, 6)}")

    theta = np.linspace(0, 2 * np.pi, 8, endpoint=False)
    circle = np.column_stack([np.cos(theta), np.sin(theta)])

    print("\nUnit circle points through each SVD stage:")
    print(f"  {'Point':>8s}  {'V^T(p)':>12s}  {'Sig*V^T(p)':>14s}  {'U*Sig*V^T(p)':>16s}")
    for i in range(len(theta)):
        p = circle[i]
        step1 = Vt @ p
        step2 = S * step1
        step3 = U @ step2
        direct = A @ p
        print(f"  ({p[0]:5.2f},{p[1]:5.2f})  "
              f"({step1[0]:5.2f},{step1[1]:5.2f})  "
              f"({step2[0]:6.2f},{step2[1]:6.2f})  "
              f"({step3[0]:6.2f},{step3[1]:6.2f})  "
              f"check=({direct[0]:6.2f},{direct[1]:6.2f})")

    print()


def demo_low_rank_approximation():
    print("=" * 70)
    print("LOW-RANK APPROXIMATION (ECKART-YOUNG)")
    print("=" * 70)

    np.random.seed(42)
    m, n, true_rank = 100, 80, 5

    U_true = np.linalg.qr(np.random.randn(m, true_rank))[0]
    V_true = np.linalg.qr(np.random.randn(n, true_rank))[0]
    S_true = np.array([50, 30, 15, 8, 3], dtype=float)
    A = U_true @ np.diag(S_true) @ V_true.T

    U, S, Vt = np.linalg.svd(A, full_matrices=False)
    print(f"\nMatrix shape: {A.shape}, true rank: {true_rank}")
    print(f"Top 10 singular values: {np.round(S[:10], 4)}")
    print(f"  (Values 6-10 should be ~0 since true rank is 5)")

    print(f"\n{'k':>3s}  {'Error':>10s}  {'Rel Error':>10s}  {'Ratio':>8s}")
    print("-" * 40)
    A_norm = np.linalg.norm(A, 'fro')
    for k in range(1, 8):
        A_k = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
        err = np.linalg.norm(A - A_k, 'fro')
        rel = err / A_norm
        ratio = compression_ratio(m, n, k)
        print(f"{k:3d}  {err:10.4f}  {rel:10.6f}  {ratio:7.1%}")

    print()


def demo_image_compression():
    print("=" * 70)
    print("IMAGE COMPRESSION WITH SVD")
    print("=" * 70)

    np.random.seed(42)
    rows, cols = 256, 256

    x = np.linspace(-3, 3, cols)
    y = np.linspace(-3, 3, rows)
    X, Y = np.meshgrid(x, y)
    image = np.sin(X) * np.cos(Y) + 0.5 * np.sin(2 * X + Y)
    image = (image - image.min()) / (image.max() - image.min()) * 255

    print(f"\nSynthetic image: {rows}x{cols} = {rows * cols:,} values")

    U, S, Vt = np.linalg.svd(image, full_matrices=False)

    print(f"\nSingular value spectrum:")
    print(f"  sigma_1   = {S[0]:.2f}")
    print(f"  sigma_5   = {S[4]:.2f}")
    print(f"  sigma_10  = {S[9]:.2f}")
    print(f"  sigma_50  = {S[49]:.2f}")
    print(f"  sigma_100 = {S[99]:.2f}")
    print(f"  sigma_256 = {S[255]:.6f}")

    total_energy = np.sum(S ** 2)
    print(f"\nCompression results:")
    print(f"{'k':>5s}  {'Storage':>10s}  {'Ratio':>8s}  {'Energy':>10s}  {'RMSE':>8s}")
    print("-" * 50)

    for k in [1, 2, 5, 10, 20, 50, 100, 200]:
        compressed = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
        storage = k * (rows + cols + 1)
        ratio = storage / (rows * cols)
        energy = np.sum(S[:k] ** 2) / total_energy
        rmse = np.sqrt(np.mean((image - compressed) ** 2))
        print(f"{k:5d}  {storage:10,d}  {ratio:7.1%}  {energy:9.4%}  {rmse:8.4f}")

    print()


def demo_recommendation_system():
    print("=" * 70)
    print("SVD FOR RECOMMENDATION SYSTEMS")
    print("=" * 70)

    np.random.seed(42)

    n_users = 10
    n_movies = 8
    n_factors = 3

    user_prefs = np.random.randn(n_users, n_factors)
    movie_attrs = np.random.randn(n_movies, n_factors)

    true_ratings = user_prefs @ movie_attrs.T
    true_ratings = (true_ratings - true_ratings.min()) / (true_ratings.max() - true_ratings.min()) * 4 + 1
    true_ratings = np.round(true_ratings, 1)

    mask = np.random.random((n_users, n_movies)) > 0.4
    observed = true_ratings.copy()
    observed[~mask] = np.nan

    print(f"\nRatings matrix ({n_users} users x {n_movies} movies):")
    print("  Observed ratings (? = missing):")
    for i in range(n_users):
        row = "  "
        for j in range(n_movies):
            if mask[i, j]:
                row += f"{observed[i, j]:5.1f}"
            else:
                row += "    ?"
        print(row)

    filled = observed.copy()
    for i in range(n_users):
        row_mean = np.nanmean(filled[i])
        filled[i, np.isnan(filled[i])] = row_mean

    U, S, Vt = np.linalg.svd(filled, full_matrices=False)

    k = n_factors
    predicted = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]

    print(f"\nRank-{k} SVD predictions for missing entries:")
    errors = []
    for i in range(n_users):
        for j in range(n_movies):
            if not mask[i, j]:
                err = abs(predicted[i, j] - true_ratings[i, j])
                errors.append(err)
                print(f"  User {i}, Movie {j}: "
                      f"predicted={predicted[i, j]:.2f}, "
                      f"true={true_ratings[i, j]:.1f}, "
                      f"error={err:.2f}")

    print(f"\nMean absolute error on missing ratings: {np.mean(errors):.3f}")

    print(f"\nLatent factors (top {k} singular values): {np.round(S[:k], 2)}")
    print(f"Remaining singular values: {np.round(S[k:], 2)}")
    energy_captured = np.sum(S[:k] ** 2) / np.sum(S ** 2)
    print(f"Energy captured by rank-{k}: {energy_captured:.1%}")

    print()


def demo_lsa():
    print("=" * 70)
    print("LATENT SEMANTIC ANALYSIS (LSA)")
    print("=" * 70)

    terms = ["cat", "dog", "fish", "kitten", "puppy",
             "ocean", "sea", "water", "bark", "meow",
             "swim", "pet", "fur", "fin", "paw"]

    docs = [
        "The cat and kitten have soft fur and paws. The cat likes to meow.",
        "The dog and puppy like to bark. Dogs have fur and paws.",
        "Fish swim in the ocean and sea. Fish have fins and swim in water.",
        "The pet cat meows while the pet dog barks.",
        "Ocean water is where fish swim. The sea has many fish.",
        "The kitten and puppy are small pets with fur and paws.",
    ]

    doc_labels = ["cat_doc", "dog_doc", "fish_doc", "pet_doc", "ocean_doc", "mixed_doc"]

    n_terms = len(terms)
    n_docs = len(docs)
    td_matrix = np.zeros((n_terms, n_docs))

    for j, doc in enumerate(docs):
        doc_lower = doc.lower()
        for i, term in enumerate(terms):
            td_matrix[i, j] = doc_lower.count(term)

    print(f"\nTerm-Document matrix ({n_terms} terms x {n_docs} docs):")
    header = "          " + "".join(f"{dl:>10s}" for dl in doc_labels)
    print(header)
    for i, term in enumerate(terms):
        row = f"{term:>10s}" + "".join(f"{td_matrix[i, j]:10.0f}" for j in range(n_docs))
        print(row)

    U, S, Vt = np.linalg.svd(td_matrix, full_matrices=False)

    print(f"\nSingular values: {np.round(S, 3)}")

    k = 3
    print(f"\nDocuments in {k}D latent space (rows of V_k^T scaled by Sigma_k):")
    doc_coords = np.diag(S[:k]) @ Vt[:k, :]
    for j in range(n_docs):
        coords = doc_coords[:, j]
        print(f"  {doc_labels[j]:>10s}: [{coords[0]:7.3f}, {coords[1]:7.3f}, {coords[2]:7.3f}]")

    print(f"\nTerms in {k}D latent space (rows of U_k scaled by Sigma_k):")
    term_coords = U[:, :k] @ np.diag(S[:k])
    for i in range(n_terms):
        coords = term_coords[i]
        print(f"  {terms[i]:>10s}: [{coords[0]:7.3f}, {coords[1]:7.3f}, {coords[2]:7.3f}]")

    print(f"\nDocument similarity (cosine similarity in latent space):")
    doc_vecs = Vt[:k, :].T
    header = "          " + "".join(f"{dl:>10s}" for dl in doc_labels)
    print(header)
    for i in range(n_docs):
        row = f"{doc_labels[i]:>10s}"
        for j in range(n_docs):
            cos_sim = np.dot(doc_vecs[i], doc_vecs[j]) / (
                np.linalg.norm(doc_vecs[i]) * np.linalg.norm(doc_vecs[j]) + 1e-10
            )
            row += f"{cos_sim:10.3f}"
        print(row)

    print()


def demo_noise_reduction():
    print("=" * 70)
    print("SVD FOR NOISE REDUCTION")
    print("=" * 70)

    np.random.seed(42)
    m, n = 100, 80

    t1 = np.linspace(0, 4 * np.pi, m)
    t2 = np.linspace(0, 2 * np.pi, n)
    clean = (5 * np.outer(np.sin(t1), np.cos(t2))
             + 3 * np.outer(np.cos(2 * t1), np.sin(t2))
             + 2 * np.outer(np.ones(m), np.sin(3 * t2)))

    print(f"\nClean signal: rank {np.linalg.matrix_rank(clean)}, shape {clean.shape}")

    noise_levels = [0.1, 0.5, 1.0, 2.0]
    clean_norm = np.linalg.norm(clean, 'fro')

    for noise_std in noise_levels:
        noise = noise_std * np.random.randn(m, n)
        noisy = clean + noise

        U, S, Vt = np.linalg.svd(noisy, full_matrices=False)

        noisy_err = np.linalg.norm(noisy - clean, 'fro') / clean_norm

        print(f"\n  Noise level sigma={noise_std}:")
        print(f"    Noisy relative error: {noisy_err:.4f}")
        print(f"    Top 10 singular values: {np.round(S[:10], 2)}")

        best_k = 1
        best_err = float('inf')
        for k in range(1, min(m, n)):
            denoised = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
            err = np.linalg.norm(denoised - clean, 'fro') / clean_norm
            if err < best_err:
                best_err = err
                best_k = k

        denoised = U[:, :best_k] @ np.diag(S[:best_k]) @ Vt[:best_k, :]
        improvement = 1 - best_err / noisy_err

        print(f"    Best truncation rank: k={best_k}")
        print(f"    Denoised relative error: {best_err:.4f}")
        print(f"    Improvement: {improvement:.1%}")

    print()


def demo_pseudoinverse():
    print("=" * 70)
    print("PSEUDOINVERSE VIA SVD")
    print("=" * 70)

    print("\n--- Overdetermined system (least squares) ---")
    A = np.array([[1, 1],
                  [2, 1],
                  [3, 1]], dtype=float)
    b = np.array([3.0, 5.0, 6.0])

    print(f"A:\n{A}")
    print(f"b: {b}")
    print("(3 equations, 2 unknowns, no exact solution)")

    A_pinv = pseudoinverse_via_svd(A)
    x_svd = A_pinv @ b
    x_lstsq = np.linalg.lstsq(A, b, rcond=None)[0]
    x_normal = np.linalg.solve(A.T @ A, A.T @ b)

    print(f"\nSVD pseudoinverse solution:     {np.round(x_svd, 6)}")
    print(f"np.linalg.lstsq solution:       {np.round(x_lstsq, 6)}")
    print(f"Normal equations solution:       {np.round(x_normal, 6)}")

    residual = A @ x_svd - b
    print(f"Residual (A x - b): {np.round(residual, 6)}")
    print(f"Residual norm: {np.linalg.norm(residual):.6f}")

    print("\n--- Underdetermined system (minimum norm) ---")
    A2 = np.array([[1, 2, 3],
                   [4, 5, 6]], dtype=float)
    b2 = np.array([14.0, 32.0])

    print(f"A:\n{A2}")
    print(f"b: {b2}")
    print("(2 equations, 3 unknowns, infinitely many solutions)")

    A2_pinv = pseudoinverse_via_svd(A2)
    x_min_norm = A2_pinv @ b2
    x_lstsq2 = np.linalg.lstsq(A2, b2, rcond=None)[0]

    print(f"\nSVD minimum-norm solution:  {np.round(x_min_norm, 6)}")
    print(f"np.linalg.lstsq solution:   {np.round(x_lstsq2, 6)}")
    print(f"Verify A x = b: {np.round(A2 @ x_min_norm, 6)}")
    print(f"Solution norm: {np.linalg.norm(x_min_norm):.6f}")

    print("\n--- Singular matrix ---")
    A3 = np.array([[1, 2],
                   [2, 4]], dtype=float)
    b3 = np.array([3.0, 6.0])

    print(f"A:\n{A3}")
    print(f"b: {b3}")
    print("(Singular matrix, rank 1)")

    U, S, Vt = np.linalg.svd(A3, full_matrices=False)
    print(f"Singular values: {np.round(S, 6)}")

    A3_pinv = pseudoinverse_via_svd(A3)
    x_pinv = A3_pinv @ b3
    print(f"Pseudoinverse solution: {np.round(x_pinv, 6)}")
    print(f"Verify A x = b: {np.round(A3 @ x_pinv, 6)}")
    print(f"Solution norm: {np.linalg.norm(x_pinv):.6f}")

    print()


def demo_condition_number():
    print("=" * 70)
    print("CONDITION NUMBER AND NUMERICAL STABILITY")
    print("=" * 70)

    matrices = [
        ("Well-conditioned", np.array([[2.0, 1.0], [1.0, 2.0]])),
        ("Moderate", np.array([[10.0, 7.0], [7.0, 5.0]])),
        ("Ill-conditioned", np.array([[1.0, 1.0], [1.0, 1.0001]])),
        ("Nearly singular", np.array([[1.0, 2.0], [0.5, 1.00001]])),
    ]

    print(f"\n{'Name':>20s}  {'sigma_max':>10s}  {'sigma_min':>10s}  {'Condition':>12s}")
    print("-" * 58)

    for name, A in matrices:
        U, S, Vt = np.linalg.svd(A)
        cond = S[0] / S[-1] if S[-1] > 1e-15 else float('inf')
        print(f"{name:>20s}  {S[0]:10.4f}  {S[-1]:10.6f}  {cond:12.1f}")

    print("\nWhy it matters:")
    print("  Condition number K means: a perturbation of size eps in the input")
    print("  can cause a perturbation of size K * eps in the output.")
    print("  K = 10^6 means you lose 6 digits of accuracy.")
    print()

    print("Comparing SVD vs eigendecomposition stability:")
    A = np.array([[1.0, 1.0], [1.0, 1.0001]])
    U, S, Vt = np.linalg.svd(A)
    AtA = A.T @ A
    eig_vals = np.linalg.eigvalsh(AtA)

    print(f"  A singular values:     {S}")
    print(f"  A condition number:    {S[0] / S[-1]:.1f}")
    print(f"  A^T A eigenvalues:     {eig_vals}")
    print(f"  A^T A condition number: {eig_vals[-1] / eig_vals[0]:.1f}")
    print(f"  (Squared! Direct SVD avoids this.)")

    print()


def demo_pca_is_svd():
    print("=" * 70)
    print("PCA IS SVD ON CENTERED DATA")
    print("=" * 70)

    np.random.seed(42)
    n_samples = 200
    n_features = 5

    mean = np.array([10, 20, 30, 40, 50], dtype=float)
    cov = np.array([
        [5.0, 2.0, 1.0, 0.5, 0.1],
        [2.0, 4.0, 1.5, 0.3, 0.2],
        [1.0, 1.5, 3.0, 0.8, 0.4],
        [0.5, 0.3, 0.8, 2.0, 0.6],
        [0.1, 0.2, 0.4, 0.6, 1.0],
    ])
    X = np.random.multivariate_normal(mean, cov, n_samples)

    X_centered = X - X.mean(axis=0)

    cov_matrix = (X_centered.T @ X_centered) / (n_samples - 1)
    eig_vals, eig_vecs = np.linalg.eigh(cov_matrix)
    idx = np.argsort(eig_vals)[::-1]
    eig_vals = eig_vals[idx]
    eig_vecs = eig_vecs[:, idx]

    U, S, Vt = np.linalg.svd(X_centered, full_matrices=False)
    svd_variance = S ** 2 / (n_samples - 1)

    print(f"\nData: {n_samples} samples, {n_features} features")
    print(f"\nPCA via eigendecomposition of covariance matrix:")
    print(f"  Eigenvalues:  {np.round(eig_vals, 4)}")
    print(f"  PC1 direction: {np.round(eig_vecs[:, 0], 4)}")

    print(f"\nPCA via SVD of centered data:")
    print(f"  S^2/(n-1):    {np.round(svd_variance, 4)}")
    print(f"  V1 direction:  {np.round(Vt[0], 4)}")

    variance_match = np.allclose(eig_vals, svd_variance, atol=1e-8)
    direction_match = all(
        np.allclose(np.abs(eig_vecs[:, i]), np.abs(Vt[i]), atol=1e-8)
        for i in range(n_features)
    )
    print(f"\n  Variances match: {variance_match}")
    print(f"  Directions match (up to sign): {direction_match}")

    explained = svd_variance / np.sum(svd_variance)
    cumulative = np.cumsum(explained)
    print(f"\n  Explained variance ratio: {np.round(explained, 4)}")
    print(f"  Cumulative:               {np.round(cumulative, 4)}")

    try:
        from sklearn.decomposition import PCA
        pca = PCA(n_components=n_features)
        pca.fit(X)
        print(f"\n  sklearn PCA variance ratio: {np.round(pca.explained_variance_ratio_, 4)}")
        print(f"  Match with our SVD: {np.allclose(explained, pca.explained_variance_ratio_, atol=1e-6)}")
    except ImportError:
        pass

    print()


def demo_matrix_properties():
    print("=" * 70)
    print("MATRIX PROPERTIES REVEALED BY SVD")
    print("=" * 70)

    np.random.seed(42)

    A = np.array([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
    ], dtype=float)

    U, S, Vt = np.linalg.svd(A)

    print(f"\nMatrix A:\n{A}")
    print(f"Singular values: {np.round(S, 6)}")

    print(f"\nRank (non-zero singular values): {np.sum(S > 1e-10)}")
    print(f"  (3x3 matrix but only rank 2: rows are linearly dependent)")

    print(f"\nFrobenius norm: {np.linalg.norm(A, 'fro'):.6f}")
    print(f"  sqrt(sum(sigma_i^2)): {np.sqrt(np.sum(S ** 2)):.6f}")

    print(f"\nSpectral norm (largest singular value): {S[0]:.6f}")
    print(f"  np.linalg.norm(A, 2): {np.linalg.norm(A, 2):.6f}")

    print(f"\nNuclear norm (sum of singular values): {np.sum(S):.6f}")

    B = np.array([[3, 1], [1, 3]], dtype=float)
    U_b, S_b, Vt_b = np.linalg.svd(B)
    print(f"\nSquare matrix B:\n{B}")
    print(f"Singular values: {S_b}")
    print(f"det(B) = {np.linalg.det(B):.4f}")
    print(f"Product of singular values: {np.prod(S_b):.4f}")
    print(f"  (|det| = product of singular values for square matrices)")

    print()


if __name__ == "__main__":
    demo_svd_basics()
    demo_geometry()
    demo_low_rank_approximation()
    demo_image_compression()
    demo_recommendation_system()
    demo_lsa()
    demo_noise_reduction()
    demo_pseudoinverse()
    demo_condition_number()
    demo_pca_is_svd()
    demo_matrix_properties()
