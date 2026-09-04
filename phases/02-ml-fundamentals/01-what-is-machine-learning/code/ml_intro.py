import numpy as np


class NearestCentroid:
    def __init__(self):
        self.classes = None
        self.centroids = None

    def fit(self, X, y):
        self.classes = np.unique(y)
        self.centroids = np.array([
            X[y == c].mean(axis=0) for c in self.classes
        ])

    def predict(self, X):
        distances = np.array([
            np.sqrt(((X - c) ** 2).sum(axis=1))
            for c in self.centroids
        ])
        return self.classes[distances.argmin(axis=0)]

    def score(self, X, y):
        return np.mean(self.predict(X) == y)


def generate_classification_data(n_per_class=100, n_features=2, separation=2.0, seed=42):
    rng = np.random.RandomState(seed)
    center_0 = np.ones(n_features) * (separation / 2)
    center_1 = np.ones(n_features) * (-separation / 2)
    X_class0 = rng.randn(n_per_class, n_features) + center_0
    X_class1 = rng.randn(n_per_class, n_features) + center_1
    X = np.vstack([X_class0, X_class1])
    y = np.array([0] * n_per_class + [1] * n_per_class)
    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def train_test_split(X, y, test_fraction=0.3, seed=42):
    rng = np.random.RandomState(seed)
    n = len(y)
    idx = rng.permutation(n)
    split = int(n * (1 - test_fraction))
    return X[idx[:split]], X[idx[split:]], y[idx[:split]], y[idx[split:]]


def random_baseline(y_train, y_test, seed=42):
    rng = np.random.RandomState(seed)
    classes, counts = np.unique(y_train, return_counts=True)
    probs = counts / counts.sum()
    preds = rng.choice(classes, size=len(y_test), p=probs)
    return np.mean(preds == y_test)


def majority_baseline(y_train, y_test):
    values, counts = np.unique(y_train, return_counts=True)
    majority_class = values[np.argmax(counts)]
    preds = np.full(len(y_test), majority_class)
    return np.mean(preds == y_test)


def demo_nearest_centroid():
    print("=" * 60)
    print("NEAREST CENTROID CLASSIFIER FROM SCRATCH")
    print("=" * 60)
    print()

    X, y = generate_classification_data(n_per_class=150, separation=2.0)
    X_train, X_test, y_train, y_test = train_test_split(X, y)

    print(f"Dataset: {len(y)} samples, {X.shape[1]} features, 2 classes")
    print(f"Train: {len(y_train)} samples, Test: {len(y_test)} samples")
    print()

    clf = NearestCentroid()
    clf.fit(X_train, y_train)

    train_acc = clf.score(X_train, y_train)
    test_acc = clf.score(X_test, y_test)

    print(f"Centroids:")
    for i, c in enumerate(clf.classes):
        print(f"  Class {c}: [{clf.centroids[i][0]:.3f}, {clf.centroids[i][1]:.3f}]")
    print()

    print(f"{'Method':<25} {'Train Acc':>10} {'Test Acc':>10}")
    print("-" * 50)
    print(f"{'Nearest Centroid':<25} {train_acc:>10.3f} {test_acc:>10.3f}")

    rand_acc = random_baseline(y_train, y_test)
    print(f"{'Random Baseline':<25} {'--':>10} {rand_acc:>10.3f}")

    maj_acc = majority_baseline(y_train, y_test)
    print(f"{'Majority Baseline':<25} {'--':>10} {maj_acc:>10.3f}")

    print()
    improvement_over_random = (test_acc - rand_acc) / rand_acc * 100
    print(f"Nearest Centroid beats random baseline by {improvement_over_random:.1f}%")


def demo_varying_difficulty():
    print()
    print("=" * 60)
    print("EFFECT OF CLASS SEPARATION ON ACCURACY")
    print("=" * 60)
    print()

    separations = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]

    print(f"{'Separation':>12} {'Train Acc':>10} {'Test Acc':>10} {'Random':>10}")
    print("-" * 50)

    for sep in separations:
        X, y = generate_classification_data(n_per_class=150, separation=sep)
        X_train, X_test, y_train, y_test = train_test_split(X, y)

        clf = NearestCentroid()
        clf.fit(X_train, y_train)

        train_acc = clf.score(X_train, y_train)
        test_acc = clf.score(X_test, y_test)
        rand_acc = random_baseline(y_train, y_test)

        print(f"{sep:>12.1f} {train_acc:>10.3f} {test_acc:>10.3f} {rand_acc:>10.3f}")

    print()
    print("Small separation: classes overlap heavily, accuracy drops.")
    print("Large separation: classes are far apart, even this simple model excels.")


def demo_higher_dimensions():
    print()
    print("=" * 60)
    print("NEAREST CENTROID IN HIGHER DIMENSIONS")
    print("=" * 60)
    print()

    dimensions = [2, 5, 10, 20, 50]

    print(f"{'Features':>10} {'Test Acc':>10}")
    print("-" * 25)

    for d in dimensions:
        X, y = generate_classification_data(n_per_class=200, n_features=d, separation=2.0)
        X_train, X_test, y_train, y_test = train_test_split(X, y)

        clf = NearestCentroid()
        clf.fit(X_train, y_train)
        test_acc = clf.score(X_test, y_test)

        print(f"{d:>10d} {test_acc:>10.3f}")

    print()
    print("With Gaussian data and fixed separation, more dimensions help.")
    print("The centroids become more distinct in higher-dimensional space.")
    print("Real data behaves differently -- the curse of dimensionality kicks in")
    print("when many features are noise.")


def demo_multiclass():
    print()
    print("=" * 60)
    print("MULTICLASS NEAREST CENTROID (3 CLASSES)")
    print("=" * 60)
    print()

    rng = np.random.RandomState(42)
    n_per_class = 100
    centers = np.array([[2, 0], [-1, 1.7], [-1, -1.7]])
    X_parts = [rng.randn(n_per_class, 2) * 0.8 + c for c in centers]
    X = np.vstack(X_parts)
    y = np.array([0] * n_per_class + [1] * n_per_class + [2] * n_per_class)

    shuffle_idx = rng.permutation(len(y))
    X, y = X[shuffle_idx], y[shuffle_idx]

    X_train, X_test, y_train, y_test = train_test_split(X, y)

    clf = NearestCentroid()
    clf.fit(X_train, y_train)

    print(f"3-class problem: {len(y)} samples")
    print(f"Centroids:")
    for i, c in enumerate(clf.classes):
        print(f"  Class {c}: [{clf.centroids[i][0]:.3f}, {clf.centroids[i][1]:.3f}]")
    print()
    print(f"Test accuracy: {clf.score(X_test, y_test):.3f}")
    print(f"Random baseline (1/3): {random_baseline(y_train, y_test):.3f}")


if __name__ == "__main__":
    demo_nearest_centroid()
    demo_varying_difficulty()
    demo_higher_dimensions()
    demo_multiclass()
    print()
    print("All ML intro demos complete.")
