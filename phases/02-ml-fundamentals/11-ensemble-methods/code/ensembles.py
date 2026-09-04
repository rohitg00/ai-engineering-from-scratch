import numpy as np
from collections import Counter


def make_classification_data(n_samples=300, n_features=5, noise=0.1, seed=42):
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features)
    boundary = 0.5 * X[:, 0] + 0.3 * X[:, 1] ** 2 - 0.2 * X[:, 2]
    y = np.where(boundary + rng.normal(0, noise, n_samples) > 0, 1, -1)
    return X, y


def make_regression_data(n_samples=300, n_features=5, noise=0.3, seed=42):
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features)
    y = 2.0 * X[:, 0] + np.sin(3 * X[:, 1]) - 0.5 * X[:, 2] ** 2 + rng.normal(0, noise, n_samples)
    return X, y


def train_test_split(X, y, test_ratio=0.2, seed=42):
    rng = np.random.RandomState(seed)
    idx = rng.permutation(len(y))
    split = int(len(y) * (1 - test_ratio))
    return X[idx[:split]], X[idx[split:]], y[idx[:split]], y[idx[split:]]


class DecisionStump:
    def __init__(self):
        self.feature_idx = None
        self.threshold = None
        self.polarity = 1
        self.alpha = None

    def fit(self, X, y, weights):
        n_samples, n_features = X.shape
        best_error = float("inf")

        for f in range(n_features):
            thresholds = np.unique(X[:, f])
            for thresh in thresholds:
                for polarity in [1, -1]:
                    pred = np.ones(n_samples)
                    pred[polarity * X[:, f] < polarity * thresh] = -1
                    error = np.sum(weights[pred != y])
                    if error < best_error:
                        best_error = error
                        self.feature_idx = f
                        self.threshold = thresh
                        self.polarity = polarity

    def predict(self, X):
        n = X.shape[0]
        pred = np.ones(n)
        idx = self.polarity * X[:, self.feature_idx] < self.polarity * self.threshold
        pred[idx] = -1
        return pred


class AdaBoostScratch:
    def __init__(self, n_estimators=50):
        self.n_estimators = n_estimators
        self.stumps = []
        self.alphas = []

    def fit(self, X, y):
        n = X.shape[0]
        weights = np.full(n, 1 / n)

        for t in range(self.n_estimators):
            stump = DecisionStump()
            stump.fit(X, y, weights)
            pred = stump.predict(X)

            err = np.sum(weights[pred != y])
            err = np.clip(err, 1e-10, 1 - 1e-10)

            alpha = 0.5 * np.log((1 - err) / err)
            weights *= np.exp(-alpha * y * pred)
            weights /= weights.sum()

            stump.alpha = alpha
            self.stumps.append(stump)
            self.alphas.append(alpha)

    def predict(self, X):
        total = sum(a * s.predict(X) for a, s in zip(self.alphas, self.stumps))
        return np.sign(total)

    def accuracy(self, X, y):
        return np.mean(self.predict(X) == y)


class TreeNode:
    def __init__(self, value=None):
        self.feature_idx = None
        self.threshold = None
        self.left = None
        self.right = None
        self.value = value


class SimpleRegressionTree:
    def __init__(self, max_depth=3, min_samples_split=2):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.root = None

    def fit(self, X, y):
        self.root = self._build(X, y, depth=0)

    def _build(self, X, y, depth):
        n_samples, n_features = X.shape

        if depth >= self.max_depth or n_samples < self.min_samples_split:
            return TreeNode(value=np.mean(y))

        best_gain = -float("inf")
        best_feature = None
        best_threshold = None

        current_var = np.var(y) * n_samples

        for f in range(n_features):
            thresholds = np.unique(X[:, f])
            if len(thresholds) > 20:
                thresholds = np.percentile(X[:, f], np.linspace(0, 100, 20))

            for thresh in thresholds:
                left_mask = X[:, f] <= thresh
                right_mask = ~left_mask

                if left_mask.sum() < 1 or right_mask.sum() < 1:
                    continue

                left_var = np.var(y[left_mask]) * left_mask.sum()
                right_var = np.var(y[right_mask]) * right_mask.sum()
                gain = current_var - left_var - right_var

                if gain > best_gain:
                    best_gain = gain
                    best_feature = f
                    best_threshold = thresh

        if best_feature is None or best_gain <= 0:
            return TreeNode(value=np.mean(y))

        left_mask = X[:, best_feature] <= best_threshold
        node = TreeNode()
        node.feature_idx = best_feature
        node.threshold = best_threshold
        node.left = self._build(X[left_mask], y[left_mask], depth + 1)
        node.right = self._build(X[~left_mask], y[~left_mask], depth + 1)
        return node

    def predict(self, X):
        return np.array([self._predict_one(x, self.root) for x in X])

    def _predict_one(self, x, node):
        if node.value is not None:
            return node.value
        if x[node.feature_idx] <= node.threshold:
            return self._predict_one(x, node.left)
        return self._predict_one(x, node.right)


class GradientBoostingScratch:
    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=3):
        self.n_estimators = n_estimators
        self.lr = learning_rate
        self.max_depth = max_depth
        self.trees = []
        self.initial_pred = None

    def fit(self, X, y):
        self.initial_pred = np.mean(y)
        current_pred = np.full(len(y), self.initial_pred)

        for _ in range(self.n_estimators):
            residuals = y - current_pred
            tree = SimpleRegressionTree(max_depth=self.max_depth)
            tree.fit(X, residuals)
            update = tree.predict(X)
            current_pred += self.lr * update
            self.trees.append(tree)

    def predict(self, X):
        pred = np.full(X.shape[0], self.initial_pred)
        for tree in self.trees:
            pred += self.lr * tree.predict(X)
        return pred

    def mse(self, X, y):
        return np.mean((self.predict(X) - y) ** 2)


class BaggingClassifier:
    def __init__(self, n_estimators=20, max_depth=5):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.trees = []

    def fit(self, X, y):
        rng = np.random.RandomState(42)
        n = len(y)

        for _ in range(self.n_estimators):
            idx = rng.choice(n, size=n, replace=True)
            tree = SimpleRegressionTree(max_depth=self.max_depth)
            tree.fit(X[idx], y[idx])
            self.trees.append(tree)

    def predict(self, X):
        predictions = np.array([tree.predict(X) for tree in self.trees])
        return np.sign(np.mean(predictions, axis=0))

    def accuracy(self, X, y):
        return np.mean(self.predict(X) == y)


class StackingClassifier:
    def __init__(self, base_models, meta_lr=0.1, n_folds=5):
        self.base_models = base_models
        self.meta_lr = meta_lr
        self.n_folds = n_folds
        self.meta_weights = None
        self.meta_bias = None
        self.fitted_models = []

    def fit(self, X, y):
        n = len(y)
        meta_features = np.zeros((n, len(self.base_models)))

        fold_size = n // self.n_folds
        indices = np.arange(n)

        for fold in range(self.n_folds):
            val_start = fold * fold_size
            val_end = val_start + fold_size if fold < self.n_folds - 1 else n
            val_idx = indices[val_start:val_end]
            train_idx = np.concatenate([indices[:val_start], indices[val_end:]])

            for m_idx, model_class in enumerate(self.base_models):
                model = model_class()
                model.fit(X[train_idx], y[train_idx])
                meta_features[val_idx, m_idx] = model.predict(X[val_idx])

        self.meta_weights = np.zeros(len(self.base_models))
        self.meta_bias = 0.0

        for _ in range(200):
            logits = meta_features @ self.meta_weights + self.meta_bias
            preds = np.tanh(logits)
            errors = y - preds
            grad_w = -2 * meta_features.T @ errors / n
            grad_b = -2 * np.sum(errors) / n
            self.meta_weights -= self.meta_lr * grad_w
            self.meta_bias -= self.meta_lr * grad_b

        self.fitted_models = []
        for model_class in self.base_models:
            model = model_class()
            model.fit(X, y)
            self.fitted_models.append(model)

    def predict(self, X):
        meta_features = np.column_stack([m.predict(X) for m in self.fitted_models])
        logits = meta_features @ self.meta_weights + self.meta_bias
        return np.sign(logits)

    def accuracy(self, X, y):
        return np.mean(self.predict(X) == y)


def demo_adaboost():
    print("=" * 60)
    print("ADABOOST FROM SCRATCH")
    print("=" * 60)

    X, y = make_classification_data(n_samples=400, n_features=5)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    for n_est in [1, 5, 10, 25, 50]:
        model = AdaBoostScratch(n_estimators=n_est)
        model.fit(X_train, y_train)
        train_acc = model.accuracy(X_train, y_train)
        test_acc = model.accuracy(X_test, y_test)
        print(f"  n_estimators={n_est:>3d}  train_acc={train_acc:.3f}  test_acc={test_acc:.3f}")

    print()

    stump = DecisionStump()
    stump.fit(X_train, y_train, np.full(len(y_train), 1 / len(y_train)))
    stump_acc = np.mean(stump.predict(X_test) == y_test)
    print(f"  Single stump accuracy: {stump_acc:.3f}")
    print(f"  AdaBoost 50 accuracy:  {model.accuracy(X_test, y_test):.3f}")
    print(f"  Improvement: {model.accuracy(X_test, y_test) - stump_acc:.3f}")
    print()


def demo_gradient_boosting():
    print("=" * 60)
    print("GRADIENT BOOSTING FROM SCRATCH")
    print("=" * 60)

    X, y = make_regression_data(n_samples=400, n_features=5)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    for n_est in [1, 10, 50, 100, 200]:
        model = GradientBoostingScratch(n_estimators=n_est, learning_rate=0.1)
        model.fit(X_train, y_train)
        train_mse = model.mse(X_train, y_train)
        test_mse = model.mse(X_test, y_test)
        print(f"  n_estimators={n_est:>3d}  train_mse={train_mse:.4f}  test_mse={test_mse:.4f}")

    print()

    single_tree = SimpleRegressionTree(max_depth=3)
    single_tree.fit(X_train, y_train)
    tree_mse = np.mean((single_tree.predict(X_test) - y_test) ** 2)
    print(f"  Single tree MSE: {tree_mse:.4f}")
    print(f"  GBM 100 MSE:     {model.mse(X_test, y_test):.4f}")
    print()


def demo_learning_rate_effect():
    print("=" * 60)
    print("LEARNING RATE vs NUMBER OF TREES")
    print("=" * 60)

    X, y = make_regression_data(n_samples=400)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    configs = [
        (0.5, 20),
        (0.1, 100),
        (0.05, 200),
        (0.01, 500),
    ]

    for lr, n_est in configs:
        model = GradientBoostingScratch(n_estimators=n_est, learning_rate=lr)
        model.fit(X_train, y_train)
        test_mse = model.mse(X_test, y_test)
        print(f"  lr={lr:.2f}, n_trees={n_est:>3d}  test_mse={test_mse:.4f}")

    print()
    print("Lower learning rates need more trees but often generalize better.")
    print()


def demo_bagging():
    print("=" * 60)
    print("BAGGING CLASSIFIER")
    print("=" * 60)

    X, y = make_classification_data(n_samples=400)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    single_tree = SimpleRegressionTree(max_depth=5)
    single_tree.fit(X_train, y_train)
    single_acc = np.mean(np.sign(single_tree.predict(X_test)) == y_test)

    bagging = BaggingClassifier(n_estimators=20, max_depth=5)
    bagging.fit(X_train, y_train)
    bag_acc = bagging.accuracy(X_test, y_test)

    print(f"  Single tree accuracy: {single_acc:.3f}")
    print(f"  Bagging (20 trees):   {bag_acc:.3f}")
    print(f"  Variance reduction:   {bag_acc - single_acc:+.3f}")
    print()


def demo_stacking():
    print("=" * 60)
    print("STACKING ENSEMBLE")
    print("=" * 60)

    X, y = make_classification_data(n_samples=400)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    def make_tree_d3():
        return SimpleRegressionTree(max_depth=3)

    def make_tree_d5():
        return SimpleRegressionTree(max_depth=5)

    def make_tree_d7():
        return SimpleRegressionTree(max_depth=7)

    make_tree_d3.fit = None
    make_tree_d5.fit = None
    make_tree_d7.fit = None

    class TreeWrapper:
        def __init__(self, max_depth):
            self.max_depth = max_depth
            self.tree = None

        def fit(self, X, y):
            self.tree = SimpleRegressionTree(max_depth=self.max_depth)
            self.tree.fit(X, y)

        def predict(self, X):
            return np.sign(self.tree.predict(X))

    base_models = [
        lambda: TreeWrapper(3),
        lambda: TreeWrapper(5),
        lambda: TreeWrapper(7),
    ]

    stack = StackingClassifier(base_models=base_models, meta_lr=0.05)
    stack.fit(X_train, y_train)

    for depth, model_fn in zip([3, 5, 7], base_models):
        m = model_fn()
        m.fit(X_train, y_train)
        acc = np.mean(m.predict(X_test) == y_test)
        print(f"  Tree depth={depth} accuracy: {acc:.3f}")

    stack_acc = stack.accuracy(X_test, y_test)
    print(f"  Stacking accuracy:    {stack_acc:.3f}")
    print(f"  Meta-learner weights: {stack.meta_weights}")
    print()


def demo_comparison():
    print("=" * 60)
    print("FULL COMPARISON")
    print("=" * 60)

    X, y = make_classification_data(n_samples=500)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    single = SimpleRegressionTree(max_depth=5)
    single.fit(X_train, y_train)
    print(f"  Single tree (d=5):    {np.mean(np.sign(single.predict(X_test)) == y_test):.3f}")

    bag = BaggingClassifier(n_estimators=20, max_depth=5)
    bag.fit(X_train, y_train)
    print(f"  Bagging (20, d=5):    {bag.accuracy(X_test, y_test):.3f}")

    ada = AdaBoostScratch(n_estimators=50)
    ada.fit(X_train, y_train)
    print(f"  AdaBoost (50 stumps): {ada.accuracy(X_test, y_test):.3f}")

    print()
    print("Bagging reduces variance (better than single tree).")
    print("Boosting reduces bias (learns complex boundaries from weak learners).")
    print()


def demo_sklearn_comparison():
    print("=" * 60)
    print("SKLEARN COMPARISON")
    print("=" * 60)

    try:
        from sklearn.ensemble import (
            AdaBoostClassifier,
            GradientBoostingClassifier,
            RandomForestClassifier,
        )
        from sklearn.metrics import accuracy_score
    except ImportError:
        print("  sklearn not installed, skipping comparison.")
        print()
        return

    X, y = make_classification_data(n_samples=500)
    y_01 = (y + 1) // 2
    X_train, X_test, y_train, y_test = train_test_split(X, y)
    X_train_01, X_test_01, y_train_01, y_test_01 = train_test_split(X, y_01)

    ada_ours = AdaBoostScratch(n_estimators=50)
    ada_ours.fit(X_train, y_train)
    print(f"  Our AdaBoost:      {ada_ours.accuracy(X_test, y_test):.3f}")

    ada_sk = AdaBoostClassifier(n_estimators=50, random_state=42, algorithm="SAMME")
    ada_sk.fit(X_train_01, y_train_01)
    print(f"  sklearn AdaBoost:  {accuracy_score(y_test_01, ada_sk.predict(X_test_01)):.3f}")

    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train_01, y_train_01)
    print(f"  sklearn RF:        {accuracy_score(y_test_01, rf.predict(X_test_01)):.3f}")

    gb = GradientBoostingClassifier(n_estimators=100, random_state=42)
    gb.fit(X_train_01, y_train_01)
    print(f"  sklearn GBM:       {accuracy_score(y_test_01, gb.predict(X_test_01)):.3f}")

    print()


if __name__ == "__main__":
    demo_adaboost()
    demo_gradient_boosting()
    demo_learning_rate_effect()
    demo_bagging()
    demo_stacking()
    demo_comparison()
    demo_sklearn_comparison()
    print("All ensemble demos complete.")
