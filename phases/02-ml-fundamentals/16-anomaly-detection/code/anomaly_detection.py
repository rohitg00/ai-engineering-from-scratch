import numpy as np


def zscore_detect(X, threshold=3.0):
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0
    z = np.abs((X - mean) / std)
    scores = z.max(axis=1)
    labels = scores > threshold
    return labels, scores


def iqr_detect(X, factor=1.5):
    q1 = np.percentile(X, 25, axis=0)
    q3 = np.percentile(X, 75, axis=0)
    iqr = q3 - q1
    iqr[iqr == 0] = 1.0
    lower = q1 - factor * iqr
    upper = q3 + factor * iqr
    below = (X - lower) / iqr
    above = (X - upper) / iqr
    scores = np.maximum(-np.minimum(below, 0), np.maximum(above, 0)).max(axis=1)
    labels = ((X < lower) | (X > upper)).any(axis=1)
    return labels, scores


def _c_factor(n):
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    h = np.log(n - 1) + 0.5772156649
    return 2.0 * h - (2.0 * (n - 1.0) / n)


class IsolationTree:
    def __init__(self, max_depth=10, rng=None):
        self.max_depth = max_depth
        self.rng = rng if rng is not None else np.random.RandomState()
        self.is_leaf = False
        self.size = 0
        self.feature = None
        self.threshold = None
        self.left = None
        self.right = None

    def fit(self, X, depth=0):
        n, p = X.shape

        if depth >= self.max_depth or n <= 1:
            self.is_leaf = True
            self.size = n
            return self

        self.feature = self.rng.randint(p)
        x_col = X[:, self.feature]
        x_min = x_col.min()
        x_max = x_col.max()

        if x_min == x_max:
            self.is_leaf = True
            self.size = n
            return self

        self.is_leaf = False
        self.threshold = self.rng.uniform(x_min, x_max)

        left_mask = x_col < self.threshold
        right_mask = ~left_mask

        self.left = IsolationTree(self.max_depth, self.rng)
        self.left.fit(X[left_mask], depth + 1)

        self.right = IsolationTree(self.max_depth, self.rng)
        self.right.fit(X[right_mask], depth + 1)

        return self

    def path_length(self, x, depth=0):
        if self.is_leaf:
            return depth + _c_factor(self.size)

        if x[self.feature] < self.threshold:
            return self.left.path_length(x, depth + 1)
        else:
            return self.right.path_length(x, depth + 1)


class IsolationForest:
    def __init__(self, n_estimators=100, max_samples=256, seed=42):
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.seed = seed
        self.trees = []
        self.n_train = 0

    def fit(self, X):
        self.n_train = X.shape[0]
        rng = np.random.RandomState(self.seed)
        self.trees = []

        sample_size = min(self.max_samples, X.shape[0])
        max_depth = int(np.ceil(np.log2(sample_size)))

        for _ in range(self.n_estimators):
            idx = rng.choice(X.shape[0], size=sample_size, replace=False)
            tree_rng = np.random.RandomState(rng.randint(0, 2**31))
            tree = IsolationTree(max_depth=max_depth, rng=tree_rng)
            tree.fit(X[idx])
            self.trees.append(tree)

        return self

    def anomaly_score(self, X):
        n = X.shape[0]
        avg_path = np.zeros(n)

        for tree in self.trees:
            for i in range(n):
                avg_path[i] += tree.path_length(X[i])

        avg_path /= self.n_estimators
        sample_size = min(self.max_samples, self.n_train)
        c = _c_factor(sample_size)
        scores = 2.0 ** (-avg_path / c) if c > 0 else np.zeros(n)

        return scores

    def predict(self, X, threshold=0.5):
        scores = self.anomaly_score(X)
        return scores > threshold, scores


def make_anomaly_data(n_normal=500, n_anomaly=25, n_features=2, seed=42):
    rng = np.random.RandomState(seed)

    center = rng.uniform(-2, 2, n_features)
    cov = np.eye(n_features) * 0.5
    X_normal = rng.multivariate_normal(center, cov, n_normal)

    X_anomaly = rng.uniform(
        X_normal.min(axis=0) - 3,
        X_normal.max(axis=0) + 3,
        (n_anomaly * 3, n_features),
    )
    distances = np.linalg.norm(X_anomaly - center, axis=1)
    far_enough = distances > 3.0
    X_anomaly = X_anomaly[far_enough][:n_anomaly]

    if len(X_anomaly) < n_anomaly:
        extra = rng.uniform(
            center - 6, center + 6,
            (n_anomaly - len(X_anomaly), n_features),
        )
        X_anomaly = np.vstack([X_anomaly, extra]) if len(X_anomaly) > 0 else extra

    X = np.vstack([X_normal, X_anomaly])
    y = np.array([0] * n_normal + [1] * len(X_anomaly))

    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def make_multimodal_data(n_per_cluster=200, n_anomaly=20, seed=42):
    rng = np.random.RandomState(seed)

    c1 = rng.multivariate_normal([0, 0], [[0.3, 0], [0, 0.3]], n_per_cluster)
    c2 = rng.multivariate_normal([5, 5], [[0.5, 0.1], [0.1, 0.5]], n_per_cluster)
    c3 = rng.multivariate_normal([-3, 4], [[0.4, -0.1], [-0.1, 0.4]], n_per_cluster)

    anomalies = rng.uniform(-6, 8, (n_anomaly, 2))

    X = np.vstack([c1, c2, c3, anomalies])
    y = np.array([0] * (3 * n_per_cluster) + [1] * n_anomaly)

    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def precision_recall(y_true, y_pred):
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    fn = np.sum((y_true == 1) & (y_pred == 0))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return precision, recall, f1


def precision_at_k(y_true, scores, k):
    top_k_idx = np.argsort(scores)[-k:]
    return np.mean(y_true[top_k_idx] == 1)


def print_separator(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def demo_zscore():
    print_separator("Z-SCORE ANOMALY DETECTION")

    X, y_true = make_anomaly_data(n_normal=500, n_anomaly=25, seed=42)
    print(f"Dataset: {X.shape[0]} samples, {(y_true == 1).sum()} anomalies")
    print()

    print(f"{'Threshold':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Flagged':>10}")
    print(f"{'-' * 52}")

    for threshold in [2.0, 2.5, 3.0, 3.5, 4.0]:
        y_pred, _ = zscore_detect(X, threshold=threshold)
        prec, rec, f1 = precision_recall(y_true, y_pred)
        flagged = y_pred.sum()
        print(f"{threshold:>10.1f} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f} {flagged:>10}")


def demo_iqr():
    print_separator("IQR ANOMALY DETECTION")

    X, y_true = make_anomaly_data(n_normal=500, n_anomaly=25, seed=42)
    print(f"Dataset: {X.shape[0]} samples, {(y_true == 1).sum()} anomalies")
    print()

    print(f"{'Factor':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Flagged':>10}")
    print(f"{'-' * 52}")

    for factor in [1.0, 1.5, 2.0, 2.5, 3.0]:
        y_pred, _ = iqr_detect(X, factor=factor)
        prec, rec, f1 = precision_recall(y_true, y_pred)
        flagged = y_pred.sum()
        print(f"{factor:>10.1f} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f} {flagged:>10}")


def demo_isolation_forest():
    print_separator("ISOLATION FOREST (FROM SCRATCH)")

    X, y_true = make_anomaly_data(n_normal=500, n_anomaly=25, seed=42)
    print(f"Dataset: {X.shape[0]} samples, {(y_true == 1).sum()} anomalies")
    print()

    iso = IsolationForest(n_estimators=100, max_samples=256, seed=42)
    iso.fit(X)
    scores = iso.anomaly_score(X)

    print("Score statistics:")
    print(f"  Normal points: mean={scores[y_true == 0].mean():.4f}, std={scores[y_true == 0].std():.4f}")
    print(f"  Anomaly points: mean={scores[y_true == 1].mean():.4f}, std={scores[y_true == 1].std():.4f}")
    print()

    print(f"{'Threshold':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Flagged':>10}")
    print(f"{'-' * 52}")

    for threshold in [0.50, 0.55, 0.60, 0.65, 0.70]:
        y_pred = scores > threshold
        prec, rec, f1 = precision_recall(y_true, y_pred)
        flagged = y_pred.sum()
        print(f"{threshold:>10.2f} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f} {flagged:>10}")

    n_anomalies = y_true.sum()
    pak = precision_at_k(y_true, scores, n_anomalies)
    print(f"\nPrecision@{n_anomalies}: {pak:.4f}")


def demo_comparison():
    print_separator("METHOD COMPARISON")

    X, y_true = make_anomaly_data(n_normal=500, n_anomaly=25, seed=42)
    n_anomalies = int(y_true.sum())
    print(f"Dataset: {X.shape[0]} samples, {n_anomalies} anomalies")
    print()

    _, z_scores = zscore_detect(X, threshold=3.0)
    _, iqr_scores = iqr_detect(X, factor=1.5)

    iso = IsolationForest(n_estimators=100, max_samples=256, seed=42)
    iso.fit(X)
    iso_scores = iso.anomaly_score(X)

    print(f"Precision@{n_anomalies} (top-k ranked by anomaly score):")
    print(f"  Z-score:          {precision_at_k(y_true, z_scores, n_anomalies):.4f}")
    print(f"  IQR:              {precision_at_k(y_true, iqr_scores, n_anomalies):.4f}")
    print(f"  Isolation Forest: {precision_at_k(y_true, iso_scores, n_anomalies):.4f}")

    print()
    z_pred, _ = zscore_detect(X, threshold=3.0)
    iqr_pred, _ = iqr_detect(X, factor=1.5)
    iso_pred = iso_scores > 0.6

    print(f"{'Method':<20} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print(f"{'-' * 52}")

    for name, pred in [("Z-score (t=3.0)", z_pred), ("IQR (f=1.5)", iqr_pred), ("IsoForest (t=0.6)", iso_pred)]:
        prec, rec, f1 = precision_recall(y_true, pred)
        print(f"{name:<20} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f}")


def demo_multimodal():
    print_separator("MULTIMODAL DATA (WHERE SIMPLE METHODS STRUGGLE)")

    X, y_true = make_multimodal_data(n_per_cluster=200, n_anomaly=20, seed=42)
    n_anomalies = int(y_true.sum())
    print(f"Dataset: {X.shape[0]} samples, {n_anomalies} anomalies, 3 clusters")
    print()

    z_pred, z_scores = zscore_detect(X, threshold=3.0)
    iqr_pred, iqr_scores = iqr_detect(X, factor=1.5)

    iso = IsolationForest(n_estimators=100, max_samples=256, seed=42)
    iso.fit(X)
    iso_scores = iso.anomaly_score(X)
    iso_pred = iso_scores > 0.6

    print(f"{'Method':<20} {'Precision':>10} {'Recall':>10} {'F1':>10} {'P@k':>10}")
    print(f"{'-' * 62}")

    for name, pred, scores in [
        ("Z-score (t=3.0)", z_pred, z_scores),
        ("IQR (f=1.5)", iqr_pred, iqr_scores),
        ("IsoForest (t=0.6)", iso_pred, iso_scores),
    ]:
        prec, rec, f1 = precision_recall(y_true, pred)
        pak = precision_at_k(y_true, scores, n_anomalies)
        print(f"{name:<20} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f} {pak:>10.4f}")

    print()
    print("Z-score struggles with multimodal data (points between clusters")
    print("look normal per feature but are anomalous in the joint space).")
    print("Isolation Forest handles multiple clusters naturally.")


if __name__ == "__main__":
    demo_zscore()
    demo_iqr()
    demo_isolation_forest()
    demo_comparison()
    demo_multimodal()
