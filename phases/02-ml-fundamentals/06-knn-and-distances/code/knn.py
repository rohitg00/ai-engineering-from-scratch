import math
import random


def l2_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def l1_distance(a, b):
    return sum(abs(ai - bi) for ai, bi in zip(a, b))


def cosine_distance(a, b):
    dot_val = sum(ai * bi for ai, bi in zip(a, b))
    norm_a = math.sqrt(sum(ai ** 2 for ai in a))
    norm_b = math.sqrt(sum(bi ** 2 for bi in b))
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return 1.0 - dot_val / (norm_a * norm_b)


def minkowski_distance(a, b, p=2):
    if p == float("inf"):
        return max(abs(ai - bi) for ai, bi in zip(a, b))
    return sum(abs(ai - bi) ** p for ai, bi in zip(a, b)) ** (1 / p)


def standardize(X):
    n = len(X)
    d = len(X[0])
    means = [sum(X[i][j] for i in range(n)) / n for j in range(d)]
    stds = [
        max(
            1e-10,
            (sum((X[i][j] - means[j]) ** 2 for i in range(n)) / n) ** 0.5,
        )
        for j in range(d)
    ]
    X_scaled = [
        [(X[i][j] - means[j]) / stds[j] for j in range(d)] for i in range(n)
    ]
    return X_scaled, means, stds


def apply_standardize(X, means, stds):
    return [[(x[j] - means[j]) / stds[j] for j in range(len(x))] for x in X]


class KNN:
    def __init__(self, k=5, distance_fn=l2_distance, weighted=False,
                 task="classification"):
        self.k = k
        self.distance_fn = distance_fn
        self.weighted = weighted
        self.task = task
        self.X_train = None
        self.y_train = None

    def fit(self, X, y):
        self.X_train = list(X)
        self.y_train = list(y)

    def predict(self, X):
        return [self._predict_one(x) for x in X]

    def _predict_one(self, x):
        distances = []
        for i in range(len(self.X_train)):
            d = self.distance_fn(x, self.X_train[i])
            distances.append((d, self.y_train[i]))
        distances.sort(key=lambda pair: pair[0])
        neighbors = distances[: self.k]

        if self.task == "classification":
            return self._classify(neighbors)
        return self._regress(neighbors)

    def _classify(self, neighbors):
        if self.weighted:
            votes = {}
            for dist, label in neighbors:
                w = 1.0 / (dist + 1e-10)
                votes[label] = votes.get(label, 0) + w
        else:
            votes = {}
            for _, label in neighbors:
                votes[label] = votes.get(label, 0) + 1
        return max(votes, key=votes.get)

    def _regress(self, neighbors):
        if self.weighted:
            w_sum = 0.0
            val_sum = 0.0
            for dist, val in neighbors:
                w = 1.0 / (dist + 1e-10)
                val_sum += w * val
                w_sum += w
            return val_sum / w_sum if w_sum > 0 else 0.0
        return sum(val for _, val in neighbors) / len(neighbors)

    def predict_with_neighbors(self, x):
        distances = []
        for i in range(len(self.X_train)):
            d = self.distance_fn(x, self.X_train[i])
            distances.append((d, i, self.y_train[i]))
        distances.sort(key=lambda t: t[0])
        neighbors = distances[: self.k]
        prediction = self._predict_one(x)
        return prediction, neighbors


class KDNode:
    def __init__(self, point, index, axis, left=None, right=None):
        self.point = point
        self.index = index
        self.axis = axis
        self.left = left
        self.right = right


class KDTree:
    def __init__(self, X):
        self.dim = len(X[0])
        indexed = [(X[i], i) for i in range(len(X))]
        self.root = self._build(indexed, depth=0)

    def _build(self, points, depth):
        if not points:
            return None
        axis = depth % self.dim
        points.sort(key=lambda p: p[0][axis])
        mid = len(points) // 2
        return KDNode(
            point=points[mid][0],
            index=points[mid][1],
            axis=axis,
            left=self._build(points[:mid], depth + 1),
            right=self._build(points[mid + 1 :], depth + 1),
        )

    def query(self, point, k=1):
        best = []
        self._search(self.root, point, k, best)
        best.sort(key=lambda x: x[0])
        return best

    def _search(self, node, point, k, best):
        if node is None:
            return

        dist = l2_distance(point, node.point)

        if len(best) < k:
            best.append((dist, node.index, node.point))
            best.sort(key=lambda x: x[0])
        elif dist < best[-1][0]:
            best[-1] = (dist, node.index, node.point)
            best.sort(key=lambda x: x[0])

        axis = node.axis
        diff = point[axis] - node.point[axis]

        if diff <= 0:
            first, second = node.left, node.right
        else:
            first, second = node.right, node.left

        self._search(first, point, k, best)

        if len(best) < k or abs(diff) < best[-1][0]:
            self._search(second, point, k, best)


def accuracy(y_true, y_pred):
    correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)
    return correct / len(y_true)


def mse(y_true, y_pred):
    return sum((a - b) ** 2 for a, b in zip(y_true, y_pred)) / len(y_true)


def generate_classification_data(n_samples=200, n_classes=3, seed=42):
    random.seed(seed)
    X = []
    y = []
    centers = [
        [1.0, 1.0],
        [-1.0, -1.0],
        [1.0, -1.0],
    ]
    for _ in range(n_samples):
        c = random.randint(0, n_classes - 1)
        x1 = centers[c][0] + random.gauss(0, 0.5)
        x2 = centers[c][1] + random.gauss(0, 0.5)
        X.append([x1, x2])
        y.append(c)
    return X, y


def generate_regression_data(n_samples=200, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n_samples):
        x = random.uniform(-3, 3)
        target = math.sin(x) + random.gauss(0, 0.15)
        X.append([x])
        y.append(target)
    return X, y


def generate_high_dim_data(n_samples=500, n_dims=2, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n_samples):
        point = [random.uniform(0, 1) for _ in range(n_dims)]
        label = 1 if sum(point[:2]) > 1.0 else 0
        X.append(point)
        y.append(label)
    return X, y


def train_test_split(X, y, test_ratio=0.2, seed=42):
    random.seed(seed)
    n = len(X)
    indices = list(range(n))
    random.shuffle(indices)
    split = int(n * (1 - test_ratio))
    train_idx = indices[:split]
    test_idx = indices[split:]
    return (
        [X[i] for i in train_idx],
        [y[i] for i in train_idx],
        [X[i] for i in test_idx],
        [y[i] for i in test_idx],
    )


def demo_basic_knn():
    print("=" * 65)
    print("KNN CLASSIFICATION: THE BASICS")
    print("=" * 65)
    print()

    X, y = generate_classification_data(200, seed=42)
    X_train, y_train, X_test, y_test = train_test_split(X, y)

    print(f"  Dataset: {len(X)} samples, 2 features, 3 classes")
    print(f"  Train: {len(X_train)}  Test: {len(X_test)}")
    print()

    k_values = [1, 3, 5, 7, 11, 15, 25, 50]
    print(f"  {'K':>6s}  {'Train Acc':>10s}  {'Test Acc':>10s}")
    print(f"  {'-' * 6}  {'-' * 10}  {'-' * 10}")

    for k in k_values:
        knn = KNN(k=k, task="classification")
        knn.fit(X_train, y_train)
        train_acc = accuracy(y_train, knn.predict(X_train))
        test_acc = accuracy(y_test, knn.predict(X_test))
        print(f"  {k:>6d}  {train_acc:>10.4f}  {test_acc:>10.4f}")

    print()
    print("  K=1: perfect training accuracy (memorization), lower test accuracy.")
    print("  Increasing K smooths the decision boundary.")
    print()


def demo_distance_metrics():
    print("=" * 65)
    print("DISTANCE METRICS: SAME DATA, DIFFERENT NEIGHBORS")
    print("=" * 65)
    print()

    X, y = generate_classification_data(200, seed=42)
    X_scaled, means, stds = standardize(X)
    X_train, y_train, X_test, y_test = train_test_split(X_scaled, y)

    metrics = [
        ("L2 (Euclidean)", l2_distance),
        ("L1 (Manhattan)", l1_distance),
        ("Cosine", cosine_distance),
    ]

    k = 5
    print(f"  K = {k}, features standardized")
    print()
    print(f"  {'Metric':<20s}  {'Test Accuracy':>14s}")
    print(f"  {'-' * 20}  {'-' * 14}")

    for name, dist_fn in metrics:
        knn = KNN(k=k, distance_fn=dist_fn, task="classification")
        knn.fit(X_train, y_train)
        test_acc = accuracy(y_test, knn.predict(X_test))
        print(f"  {name:<20s}  {test_acc:>14.4f}")

    print()

    query = X_test[0]
    print(f"  Query point: [{query[0]:.3f}, {query[1]:.3f}]")
    print(f"  True label: {y_test[0]}")
    print()

    for name, dist_fn in metrics:
        knn = KNN(k=k, distance_fn=dist_fn, task="classification")
        knn.fit(X_train, y_train)
        pred, neighbors = knn.predict_with_neighbors(query)
        print(f"  {name}: prediction = {pred}")
        for dist, idx, label in neighbors:
            print(f"    neighbor idx={idx}, label={label}, dist={dist:.4f}")
        print()


def demo_weighted_knn():
    print("=" * 65)
    print("WEIGHTED vs UNWEIGHTED KNN")
    print("=" * 65)
    print()

    X, y = generate_classification_data(200, seed=42)
    X_scaled, _, _ = standardize(X)
    X_train, y_train, X_test, y_test = train_test_split(X_scaled, y)

    k_values = [3, 7, 15, 25]
    print(f"  {'K':>6s}  {'Unweighted':>12s}  {'Weighted':>12s}  {'Diff':>8s}")
    print(f"  {'-' * 6}  {'-' * 12}  {'-' * 12}  {'-' * 8}")

    for k in k_values:
        knn_uw = KNN(k=k, weighted=False, task="classification")
        knn_w = KNN(k=k, weighted=True, task="classification")
        knn_uw.fit(X_train, y_train)
        knn_w.fit(X_train, y_train)
        acc_uw = accuracy(y_test, knn_uw.predict(X_test))
        acc_w = accuracy(y_test, knn_w.predict(X_test))
        diff = acc_w - acc_uw
        print(f"  {k:>6d}  {acc_uw:>12.4f}  {acc_w:>12.4f}  {diff:>+8.4f}")

    print()
    print("  Weighted KNN is less sensitive to large K values.")
    print("  Distant neighbors contribute less, so increasing K is safer.")
    print()


def demo_regression():
    print("=" * 65)
    print("KNN REGRESSION: APPROXIMATING sin(x)")
    print("=" * 65)
    print()

    X, y = generate_regression_data(200, seed=42)
    X_train, y_train, X_test, y_test = train_test_split(X, y)

    k_values = [1, 3, 5, 10, 20, 50]
    print(f"  Target: y = sin(x) + noise")
    print(f"  Train: {len(X_train)}  Test: {len(X_test)}")
    print()
    print(f"  {'K':>6s}  {'Unweighted MSE':>16s}  {'Weighted MSE':>14s}")
    print(f"  {'-' * 6}  {'-' * 16}  {'-' * 14}")

    for k in k_values:
        knn_uw = KNN(k=k, task="regression", weighted=False)
        knn_w = KNN(k=k, task="regression", weighted=True)
        knn_uw.fit(X_train, y_train)
        knn_w.fit(X_train, y_train)
        mse_uw = mse(y_test, knn_uw.predict(X_test))
        mse_w = mse(y_test, knn_w.predict(X_test))
        print(f"  {k:>6d}  {mse_uw:>16.6f}  {mse_w:>14.6f}")

    print()
    print("  K=1 overfits (follows noise). Large K underfits (over-smooths).")
    print("  Weighted KNN smooths predictions while respecting local structure.")
    print()

    knn = KNN(k=5, task="regression", weighted=True)
    knn.fit(X_train, y_train)

    print("  Sample predictions (K=5, weighted):")
    print(f"  {'x':>8s}  {'True y':>8s}  {'Pred y':>8s}  {'Error':>8s}")
    print(f"  {'-' * 8}  {'-' * 8}  {'-' * 8}  {'-' * 8}")
    for i in range(min(10, len(X_test))):
        pred = knn.predict([X_test[i]])[0]
        err = abs(y_test[i] - pred)
        print(f"  {X_test[i][0]:>8.3f}  {y_test[i]:>8.3f}  {pred:>8.3f}  {err:>8.3f}")
    print()


def demo_curse_of_dimensionality():
    print("=" * 65)
    print("CURSE OF DIMENSIONALITY")
    print("=" * 65)
    print()

    dims = [2, 5, 10, 20, 50, 100]
    n_points = 200

    print("  Part 1: Distance ratio convergence")
    print(f"  {n_points} random uniform points in [0, 1]^d")
    print()
    print(f"  {'Dimensions':>12s}  {'Max/Min dist':>14s}  {'Mean dist':>10s}  {'Std dist':>10s}")
    print(f"  {'-' * 12}  {'-' * 14}  {'-' * 10}  {'-' * 10}")

    for d in dims:
        random.seed(42)
        points = [[random.uniform(0, 1) for _ in range(d)] for _ in range(n_points)]

        distances = []
        sample_size = min(500, n_points * (n_points - 1) // 2)
        for _ in range(sample_size):
            i = random.randint(0, n_points - 1)
            j = random.randint(0, n_points - 1)
            if i != j:
                distances.append(l2_distance(points[i], points[j]))

        if distances:
            max_d = max(distances)
            min_d = min(d_val for d_val in distances if d_val > 0)
            mean_d = sum(distances) / len(distances)
            std_d = (sum((d_val - mean_d) ** 2 for d_val in distances) / len(distances)) ** 0.5
            ratio = max_d / min_d if min_d > 0 else float("inf")
            print(f"  {d:>12d}  {ratio:>14.4f}  {mean_d:>10.4f}  {std_d:>10.4f}")

    print()
    print("  As dimensions grow, max/min ratio shrinks toward 1.")
    print("  All points become equally distant. 'Nearest' loses meaning.")
    print()

    print("  Part 2: KNN accuracy vs dimensionality")
    print(f"  Binary classification: label = 1 if x[0] + x[1] > 1, else 0")
    print(f"  Extra dimensions are pure noise.")
    print()
    print(f"  {'Dimensions':>12s}  {'K=5 Acc':>10s}  {'K=15 Acc':>10s}")
    print(f"  {'-' * 12}  {'-' * 10}  {'-' * 10}")

    for d in [2, 5, 10, 20, 50]:
        X, y = generate_high_dim_data(400, n_dims=d, seed=42)
        X_scaled, _, _ = standardize(X)
        X_train, y_train, X_test, y_test = train_test_split(X_scaled, y)

        knn5 = KNN(k=5, task="classification")
        knn15 = KNN(k=15, task="classification")
        knn5.fit(X_train, y_train)
        knn15.fit(X_train, y_train)
        acc5 = accuracy(y_test, knn5.predict(X_test))
        acc15 = accuracy(y_test, knn15.predict(X_test))
        print(f"  {d:>12d}  {acc5:>10.4f}  {acc15:>10.4f}")

    print()
    print("  Accuracy degrades as noisy dimensions increase.")
    print("  The signal (first 2 dims) gets drowned by noise dimensions.")
    print()


def demo_kdtree():
    print("=" * 65)
    print("KD-TREE: EFFICIENT NEAREST NEIGHBOR SEARCH")
    print("=" * 65)
    print()

    random.seed(42)
    sizes = [100, 500, 1000, 5000]

    print(f"  2D data, finding 5 nearest neighbors")
    print()
    print(f"  {'N points':>10s}  {'Brute force':>14s}  {'KD-tree':>14s}  {'Speedup':>10s}")
    print(f"  {'-' * 10}  {'-' * 14}  {'-' * 14}  {'-' * 10}")

    for n in sizes:
        X = [[random.uniform(0, 10) for _ in range(2)] for _ in range(n)]
        query = [5.0, 5.0]
        k = 5

        import time

        n_queries = 100
        queries = [[random.uniform(0, 10) for _ in range(2)] for _ in range(n_queries)]

        start = time.time()
        for q in queries:
            dists = [(l2_distance(q, X[i]), i) for i in range(n)]
            dists.sort()
            _ = dists[:k]
        brute_time = time.time() - start

        tree = KDTree(X)

        start = time.time()
        for q in queries:
            _ = tree.query(q, k=k)
        kd_time = time.time() - start

        speedup = brute_time / kd_time if kd_time > 0 else float("inf")
        print(f"  {n:>10d}  {brute_time:>14.4f}s  {kd_time:>14.4f}s  {speedup:>10.1f}x")

    print()

    X = [[random.uniform(0, 10) for _ in range(2)] for _ in range(100)]
    tree = KDTree(X)
    query = [5.0, 5.0]

    brute = [(l2_distance(query, X[i]), i) for i in range(len(X))]
    brute.sort()
    brute_top5 = [(d, idx) for d, idx in brute[:5]]

    kd_top5 = [(d, idx) for d, idx, _ in tree.query(query, k=5)]

    print("  Verification (100 points, k=5):")
    print(f"    Brute force: {[(round(d, 4), idx) for d, idx in brute_top5]}")
    print(f"    KD-tree:     {[(round(d, 4), idx) for d, idx in kd_top5]}")
    match = set(idx for _, idx in brute_top5) == set(idx for _, idx in kd_top5)
    print(f"    Results match: {match}")
    print()


def demo_scaling_importance():
    print("=" * 65)
    print("FEATURE SCALING: WHY IT MATTERS FOR KNN")
    print("=" * 65)
    print()

    random.seed(42)
    X = []
    y = []
    for _ in range(200):
        age = random.gauss(40, 15)
        salary = random.gauss(50000, 20000)
        label = 1 if age > 45 and salary < 40000 else 0
        X.append([age, salary])
        y.append(label)

    X_train, y_train, X_test, y_test = train_test_split(X, y)

    knn_raw = KNN(k=5, task="classification")
    knn_raw.fit(X_train, y_train)
    acc_raw = accuracy(y_test, knn_raw.predict(X_test))

    X_train_s, means, stds = standardize(X_train)
    X_test_s = apply_standardize(X_test, means, stds)

    knn_scaled = KNN(k=5, task="classification")
    knn_scaled.fit(X_train_s, y_train)
    acc_scaled = accuracy(y_test, knn_scaled.predict(X_test_s))

    print(f"  Features: age (range ~10-70), salary (range ~10k-90k)")
    print()
    print(f"  Without scaling: accuracy = {acc_raw:.4f}")
    print(f"  With scaling:    accuracy = {acc_scaled:.4f}")
    print()

    query = X_test[0]
    query_s = X_test_s[0]

    dists_raw = [(l2_distance(query, X_train[i]), i) for i in range(5)]
    dists_raw.sort()
    dists_scaled = [(l2_distance(query_s, X_train_s[i]), i) for i in range(5)]
    dists_scaled.sort()

    print(f"  Sample distances for first test point:")
    print(f"  Without scaling: {[round(d, 1) for d, _ in dists_raw]}")
    print(f"  With scaling:    {[round(d, 4) for d, _ in dists_scaled]}")
    print()
    print("  Unscaled: salary dominates (tens of thousands vs tens of years).")
    print("  Scaled: both features contribute equally to distance.")
    print()


def demo_lazy_vs_eager():
    print("=" * 65)
    print("LAZY vs EAGER LEARNING: TIMING COMPARISON")
    print("=" * 65)
    print()

    import time

    random.seed(42)
    sizes = [100, 500, 1000, 5000]

    print(f"  {'N':>6s}  {'KNN train':>12s}  {'KNN predict':>14s}  {'Total':>10s}")
    print(f"  {'-' * 6}  {'-' * 12}  {'-' * 14}  {'-' * 10}")

    for n in sizes:
        X = [[random.gauss(0, 1) for _ in range(5)] for _ in range(n)]
        y = [random.choice([0, 1]) for _ in range(n)]

        n_test = min(50, n // 5)
        X_test_local = [[random.gauss(0, 1) for _ in range(5)] for _ in range(n_test)]

        knn = KNN(k=5, task="classification")

        start = time.time()
        knn.fit(X, y)
        train_time = time.time() - start

        start = time.time()
        knn.predict(X_test_local)
        pred_time = time.time() - start

        total = train_time + pred_time
        print(f"  {n:>6d}  {train_time:>12.6f}s  {pred_time:>14.6f}s  {total:>10.6f}s")

    print()
    print("  KNN training is O(1): just store the data.")
    print("  KNN prediction is O(n*d) per query: compute all distances.")
    print("  For eager learners (neural nets), the pattern is reversed.")
    print()


def demo_minkowski_family():
    print("=" * 65)
    print("MINKOWSKI DISTANCE FAMILY")
    print("=" * 65)
    print()

    a = [1.0, 2.0, 3.0]
    b = [4.0, 0.0, 6.0]

    p_values = [1, 1.5, 2, 3, 5, 10, float("inf")]
    print(f"  a = {a}")
    print(f"  b = {b}")
    print()
    print(f"  {'p':>8s}  {'Distance':>12s}  {'Name':>15s}")
    print(f"  {'-' * 8}  {'-' * 12}  {'-' * 15}")

    for p in p_values:
        d = minkowski_distance(a, b, p)
        if p == 1:
            name = "Manhattan (L1)"
        elif p == 2:
            name = "Euclidean (L2)"
        elif p == float("inf"):
            name = "Chebyshev (Linf)"
        else:
            name = f"Lp (p={p})"
        p_str = "inf" if p == float("inf") else str(p)
        print(f"  {p_str:>8s}  {d:>12.4f}  {name:>15s}")

    print()
    print("  As p increases, the distance is dominated by the largest component difference.")
    print("  L-inf <= L2 <= L1 always holds.")
    print()


def demo_k_selection():
    print("=" * 65)
    print("SELECTING K: CROSS-VALIDATION APPROACH")
    print("=" * 65)
    print()

    X, y = generate_classification_data(300, seed=42)

    n = len(X)
    random.seed(42)
    indices = list(range(n))
    random.shuffle(indices)

    n_folds = 5
    fold_size = n // n_folds

    k_values = [1, 3, 5, 7, 9, 11, 15, 21, 31]

    print(f"  {n_folds}-fold cross-validation on {n} samples")
    print()
    print(f"  {'K':>6s}  {'Mean Acc':>10s}  {'Std Acc':>10s}  {'Visual':>20s}")
    print(f"  {'-' * 6}  {'-' * 10}  {'-' * 10}  {'-' * 20}")

    best_k = 1
    best_mean = 0.0

    for k in k_values:
        fold_accs = []

        for fold in range(n_folds):
            val_start = fold * fold_size
            val_end = val_start + fold_size
            val_idx = indices[val_start:val_end]
            train_idx = indices[:val_start] + indices[val_end:]

            X_tr = [X[i] for i in train_idx]
            y_tr = [y[i] for i in train_idx]
            X_val = [X[i] for i in val_idx]
            y_val = [y[i] for i in val_idx]

            knn = KNN(k=k, task="classification")
            knn.fit(X_tr, y_tr)
            acc_val = accuracy(y_val, knn.predict(X_val))
            fold_accs.append(acc_val)

        mean_acc = sum(fold_accs) / len(fold_accs)
        std_acc = (sum((a - mean_acc) ** 2 for a in fold_accs) / len(fold_accs)) ** 0.5

        bar_len = int(mean_acc * 20)
        bar = "#" * bar_len

        if mean_acc > best_mean:
            best_mean = mean_acc
            best_k = k

        print(f"  {k:>6d}  {mean_acc:>10.4f}  {std_acc:>10.4f}  {bar}")

    print()
    print(f"  Best K = {best_k} with mean accuracy = {best_mean:.4f}")
    print()


def print_summary():
    print()
    print("=" * 65)
    print("SUMMARY")
    print("=" * 65)
    print()
    print("  1. KNN is lazy: zero training, all work at prediction time.")
    print("  2. K controls bias-variance: small K overfits, large K underfits.")
    print("  3. Distance metric choice matters. L2 is default, cosine for text.")
    print("  4. Always scale features. Unscaled features distort distances.")
    print("  5. Weighted KNN reduces sensitivity to K by down-weighting distant neighbors.")
    print("  6. Curse of dimensionality: KNN degrades beyond ~20-50 dimensions.")
    print("  7. KD-trees speed up search in low dimensions. Ball trees for moderate.")
    print("  8. KNN is the same algorithm behind vector databases and RAG retrieval.")
    print()


if __name__ == "__main__":
    demo_basic_knn()
    demo_distance_metrics()
    demo_weighted_knn()
    demo_regression()
    demo_minkowski_family()
    demo_curse_of_dimensionality()
    demo_scaling_importance()
    demo_kdtree()
    demo_lazy_vs_eager()
    demo_k_selection()
    print_summary()
