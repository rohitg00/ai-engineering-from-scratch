import numpy as np


class PCA:
    def __init__(self, n_components):
        self.n_components = n_components
        self.components = None
        self.mean = None
        self.eigenvalues = None
        self.explained_variance_ratio_ = None

    def fit(self, X):
        self.mean = np.mean(X, axis=0)
        X_centered = X - self.mean

        cov_matrix = np.cov(X_centered, rowvar=False)

        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

        sorted_idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[sorted_idx]
        eigenvectors = eigenvectors[:, sorted_idx]

        self.components = eigenvectors[:, : self.n_components].T
        self.eigenvalues = eigenvalues[: self.n_components]
        total_var = np.sum(eigenvalues)
        self.explained_variance_ratio_ = self.eigenvalues / total_var

        return self

    def transform(self, X):
        X_centered = X - self.mean
        return X_centered @ self.components.T

    def fit_transform(self, X):
        self.fit(X)
        return self.transform(X)

    def inverse_transform(self, X_reduced):
        return X_reduced @ self.components + self.mean


def demo_synthetic():
    print("=" * 60)
    print("PCA on synthetic 3D data")
    print("=" * 60)

    np.random.seed(42)
    n_samples = 500

    t = np.random.uniform(0, 2 * np.pi, n_samples)
    x1 = 3 * np.cos(t) + np.random.normal(0, 0.2, n_samples)
    x2 = 3 * np.sin(t) + np.random.normal(0, 0.2, n_samples)
    x3 = 0.5 * x1 + 0.3 * x2 + np.random.normal(0, 0.1, n_samples)

    X = np.column_stack([x1, x2, x3])

    pca = PCA(n_components=2)
    X_reduced = pca.fit_transform(X)

    print(f"Original shape: {X.shape}")
    print(f"Reduced shape:  {X_reduced.shape}")
    print(f"Explained variance ratios: {pca.explained_variance_ratio_}")
    print(f"Total variance captured: {sum(pca.explained_variance_ratio_):.4f}")

    X_reconstructed = pca.inverse_transform(X_reduced)
    mse = np.mean((X - X_reconstructed) ** 2)
    print(f"Reconstruction MSE: {mse:.6f}")
    print()


def demo_mnist():
    print("=" * 60)
    print("PCA on MNIST digits")
    print("=" * 60)

    from sklearn.datasets import fetch_openml

    mnist = fetch_openml("mnist_784", version=1, as_frame=False, parser="auto")
    X = mnist.data[:5000].astype(float)
    y = mnist.target[:5000].astype(int)

    pca_50 = PCA(n_components=50)
    X_pca50 = pca_50.fit_transform(X)
    print(f"50 components capture {sum(pca_50.explained_variance_ratio_):.2%} of variance")

    pca_2d = PCA(n_components=2)
    X_pca2d = pca_2d.fit_transform(X)
    print(f"2 components capture {sum(pca_2d.explained_variance_ratio_):.2%} of variance")

    for k in [10, 50, 200]:
        pca_k = PCA(n_components=k)
        X_k = pca_k.fit_transform(X)
        X_rec = pca_k.inverse_transform(X_k)
        mse = np.mean((X - X_rec) ** 2)
        var = sum(pca_k.explained_variance_ratio_)
        print(f"k={k:>3d}  variance={var:.4f}  reconstruction_mse={mse:.2f}")

    print()
    return X, y, X_pca2d


def demo_sklearn_comparison(X, X_ours):
    print("=" * 60)
    print("Comparison: our PCA vs sklearn PCA")
    print("=" * 60)

    from sklearn.decomposition import PCA as SklearnPCA

    sklearn_pca = SklearnPCA(n_components=2)
    X_sklearn = sklearn_pca.fit_transform(X)

    pca_ours = PCA(n_components=2)
    pca_ours.fit(X)

    print(f"Our explained variance:     {pca_ours.explained_variance_ratio_}")
    print(f"Sklearn explained variance: {sklearn_pca.explained_variance_ratio_}")

    diff = np.abs(np.abs(X_ours) - np.abs(X_sklearn))
    print(f"Max absolute difference (sign-invariant): {diff.max():.10f}")
    print()


def demo_tsne(X, y):
    print("=" * 60)
    print("t-SNE on MNIST (5000 samples)")
    print("=" * 60)

    from sklearn.manifold import TSNE

    pca_pre = PCA(n_components=50)
    X_pca = pca_pre.fit_transform(X)

    tsne = TSNE(n_components=2, perplexity=30, random_state=42)
    X_tsne = tsne.fit_transform(X_pca)
    print(f"t-SNE output shape: {X_tsne.shape}")
    print(f"t-SNE x range: [{X_tsne[:, 0].min():.1f}, {X_tsne[:, 0].max():.1f}]")
    print(f"t-SNE y range: [{X_tsne[:, 1].min():.1f}, {X_tsne[:, 1].max():.1f}]")
    print()


def demo_umap(X, y):
    print("=" * 60)
    print("UMAP on MNIST (5000 samples)")
    print("=" * 60)

    try:
        from umap import UMAP

        pca_pre = PCA(n_components=50)
        X_pca = pca_pre.fit_transform(X)

        reducer = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
        X_umap = reducer.fit_transform(X_pca)
        print(f"UMAP output shape: {X_umap.shape}")
        print(f"UMAP x range: [{X_umap[:, 0].min():.1f}, {X_umap[:, 0].max():.1f}]")
        print(f"UMAP y range: [{X_umap[:, 1].min():.1f}, {X_umap[:, 1].max():.1f}]")
    except ImportError:
        print("Install umap-learn to run this demo: pip install umap-learn")

    print()


def demo_pca_preprocessing(X, y):
    print("=" * 60)
    print("PCA as preprocessing for logistic regression")
    print("=" * 60)

    from sklearn.decomposition import PCA as SklearnPCA
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    for k in [10, 30, 50, 100, 200, 784]:
        if k < X_train.shape[1]:
            pca_k = SklearnPCA(n_components=k)
            X_tr = pca_k.fit_transform(X_train)
            X_te = pca_k.transform(X_test)
            var_captured = sum(pca_k.explained_variance_ratio_)
        else:
            X_tr = X_train
            X_te = X_test
            var_captured = 1.0

        clf = LogisticRegression(max_iter=1000, random_state=42)
        clf.fit(X_tr, y_train)
        acc = accuracy_score(y_test, clf.predict(X_te))
        print(f"k={k:>3d}  accuracy={acc:.4f}  variance={var_captured:.4f}")

    print()


def kernel_pca(X, n_components, kernel="rbf", gamma=1.0):
    n = X.shape[0]

    if kernel == "rbf":
        sq_dists = np.sum(X ** 2, axis=1).reshape(-1, 1) + np.sum(X ** 2, axis=1).reshape(1, -1) - 2 * X @ X.T
        K = np.exp(-gamma * sq_dists)
    elif kernel == "poly":
        K = (X @ X.T + 1) ** gamma
    else:
        K = X @ X.T

    one_n = np.ones((n, n)) / n
    K_centered = K - one_n @ K - K @ one_n + one_n @ K @ one_n

    eigenvalues, eigenvectors = np.linalg.eigh(K_centered)

    sorted_idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[sorted_idx]
    eigenvectors = eigenvectors[:, sorted_idx]

    top_vals = eigenvalues[:n_components]
    top_vecs = eigenvectors[:, :n_components]

    for i in range(n_components):
        if top_vals[i] > 1e-10:
            top_vecs[:, i] = top_vecs[:, i] / np.sqrt(top_vals[i])

    return top_vecs * top_vals[:n_components]


def reconstruction_error(X, X_reconstructed):
    return np.mean((X - X_reconstructed) ** 2)


def demo_kernel_pca():
    print("=" * 60)
    print("KERNEL PCA: Concentric circles")
    print("=" * 60)

    np.random.seed(42)
    n_per_ring = 200

    theta_inner = np.random.uniform(0, 2 * np.pi, n_per_ring)
    r_inner = 1.0 + np.random.normal(0, 0.1, n_per_ring)
    inner = np.column_stack([r_inner * np.cos(theta_inner), r_inner * np.sin(theta_inner)])

    theta_outer = np.random.uniform(0, 2 * np.pi, n_per_ring)
    r_outer = 3.0 + np.random.normal(0, 0.1, n_per_ring)
    outer = np.column_stack([r_outer * np.cos(theta_outer), r_outer * np.sin(theta_outer)])

    X_circles = np.vstack([inner, outer])
    labels = np.array([0] * n_per_ring + [1] * n_per_ring)

    pca_linear = PCA(n_components=1)
    X_linear = pca_linear.fit_transform(X_circles)

    inner_range_linear = (X_linear[labels == 0].min(), X_linear[labels == 0].max())
    outer_range_linear = (X_linear[labels == 1].min(), X_linear[labels == 1].max())

    print(f"\n  Data: {n_per_ring} points per ring, 2 concentric circles")
    print("\n  Linear PCA (1 component):")
    print(f"    Inner ring range: [{inner_range_linear[0]:.2f}, {inner_range_linear[1]:.2f}]")
    print(f"    Outer ring range: [{outer_range_linear[0]:.2f}, {outer_range_linear[1]:.2f}]")
    overlap = inner_range_linear[1] > outer_range_linear[0] and outer_range_linear[1] > inner_range_linear[0]
    print(f"    Overlapping: {overlap} (linear PCA cannot separate circles)")

    X_kpca = kernel_pca(X_circles, n_components=2, kernel="rbf", gamma=0.5)

    inner_mean = X_kpca[labels == 0, 0].mean()
    outer_mean = X_kpca[labels == 1, 0].mean()
    separation = abs(outer_mean - inner_mean)

    print("\n  Kernel PCA (RBF, gamma=0.5, 2 components):")
    print(f"    Inner ring PC1 mean: {inner_mean:.4f}")
    print(f"    Outer ring PC1 mean: {outer_mean:.4f}")
    print(f"    Separation on PC1: {separation:.4f}")
    print("    Kernel PCA separates the circles in the first component")

    for g in [0.1, 0.5, 1.0, 5.0]:
        X_k = kernel_pca(X_circles, n_components=2, kernel="rbf", gamma=g)
        inner_m = X_k[labels == 0, 0].mean()
        outer_m = X_k[labels == 1, 0].mean()
        sep = abs(outer_m - inner_m)
        print(f"    gamma={g:<4}  separation={sep:.4f}")

    print()


def demo_reconstruction_error():
    print("=" * 60)
    print("RECONSTRUCTION ERROR vs NUMBER OF COMPONENTS")
    print("=" * 60)

    np.random.seed(42)
    n_samples = 300
    n_features = 20
    n_informative = 5

    base = np.random.randn(n_samples, n_informative)
    mixing = np.random.randn(n_informative, n_features)
    noise = np.random.randn(n_samples, n_features) * 0.1
    X = base @ mixing + noise

    total_var_pca = PCA(n_components=n_features)
    total_var_pca.fit(X)
    all_eigenvalues = total_var_pca.eigenvalues

    print(f"\n  Data: {n_samples} samples, {n_features} features, {n_informative} informative")
    print(f"\n  {'k':>4s}  {'Recon MSE':>12s}  {'Explained Var':>14s}  {'Cumulative':>11s}")
    print(f"  {'':->4s}  {'':->12s}  {'':->14s}  {'':->11s}")

    cumulative = 0.0
    for k in [1, 2, 3, 5, 10, 15, 20]:
        pca_k = PCA(n_components=k)
        X_reduced = pca_k.fit_transform(X)
        X_reconstructed = pca_k.inverse_transform(X_reduced)
        mse = reconstruction_error(X, X_reconstructed)
        cumulative = sum(pca_k.explained_variance_ratio_)
        ev = pca_k.explained_variance_ratio_[-1] if k > 0 else 0
        print(f"  {k:>4d}  {mse:>12.4f}  {ev:>14.6f}  {cumulative:>11.4f}")

    print(f"\n  The data is effectively {n_informative}-dimensional.")
    print(f"  After k={n_informative}, reconstruction error drops to near-noise level.")
    print("  Additional components capture only noise variance.")
    print()


if __name__ == "__main__":
    demo_kernel_pca()
    demo_reconstruction_error()
    demo_synthetic()

    X, y, X_pca2d = demo_mnist()
    demo_sklearn_comparison(X, X_pca2d)
    demo_tsne(X, y)
    demo_umap(X, y)
    demo_pca_preprocessing(X, y)
