import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

X_1D = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
Y_EX = np.array([0, 0, 1, 0, 1, 1])
X_2D = np.array([[1.0, 1.0], [2.0, 2.0], [3.0, 9.0], [4.0, 3.0], [5.0, 8.0], [6.0, 7.0]])


def brute_best(X, y):
    n, d = X.shape
    best = None
    for f in range(d):
        values = np.unique(X[:, f])
        for i in range(len(values) - 1):
            t = (values[i] + values[i + 1]) / 2.0
            score = 0.0
            for side in (y[X[:, f] <= t], y[X[:, f] > t]):
                if len(side):
                    p = np.array([np.mean(side == c) for c in np.unique(side)])
                    score += len(side) / n * (1.0 - np.sum(p ** 2))
            if best is None or score < best[2] - 1e-12:
                best = (f, t, score)
    return best


def check_split(result, expected, what):
    if expected is None:
        true(result is None, f"{what} must be None", None, result)
        return
    true(result is not None and len(result) == 3, f"{what} must be a tuple (feature, threshold, impurity)", expected, result)
    equal(int(result[0]), int(expected[0]), what=f"the feature of {what}")
    close(result[1], expected[1], rtol=1e-12, what=f"the threshold of {what}")
    close(result[2], expected[2], rtol=1e-9, atol=1e-12, what=f"the impurity of {what}")


@check("examples", "Gini impurity of six labels", "Gini impurity is 1 minus the sum of the squared class fractions. Here the fractions are 2/6, 3/6 and 1/6.")
def example_gini(sub):
    close(sub.gini_impurity(np.array([0, 0, 1, 1, 1, 2])), 0.6111111111111112, rtol=1e-12, what="the impurity")


@check("examples", "best threshold with a tie", "The thresholds 2.5 and 4.5 both give weighted impurity 0.25. The tie rule keeps the lower threshold.")
def example_threshold(sub):
    close(sub.split_impurity(X_1D.copy(), Y_EX.copy(), 2.5), 0.25, rtol=1e-12, what="the weighted impurity at 2.5")
    result = sub.best_threshold(X_1D.copy(), Y_EX.copy())
    true(result is not None and len(result) == 2, "best_threshold must return a tuple (threshold, impurity)", (2.5, 0.25), result)
    close(result[0], 2.5, what="the threshold")
    close(result[1], 0.25, rtol=1e-12, what="the impurity")


@check("examples", "best split over two features", "Feature 1 separates the classes fully at 5.0, so its weighted impurity is 0.")
def example_split(sub):
    check_split(sub.best_split(X_2D.copy(), Y_EX.copy()), (1, 5.0, 0.0), "the best split")


@check("properties", "Gini impurity stays in its range", "Gini impurity is 0 for a pure set and at most 1 - 1/C for C classes. It does not depend on the order of the labels.")
def gini_range(sub):
    rng = np.random.default_rng(0)
    for c in [2, 3, 5]:
        labels = rng.integers(0, c, size=40)
        value = sub.gini_impurity(labels)
        true(0.0 <= value <= 1.0 - 1.0 / c + 1e-12, f"the impurity for {c} classes is outside [0, 1 - 1/C]", f"from 0 to {1.0 - 1.0 / c:.4f}", value)
        close(sub.gini_impurity(rng.permutation(labels)), value, rtol=1e-12, what="the impurity of the shuffled labels")
    close(sub.gini_impurity(np.array([4, 4, 4])), 0.0, what="the impurity of a pure set")
    close(sub.gini_impurity(np.array([0, 1, 2, 3])), 0.75, rtol=1e-12, what="the impurity of 4 equal classes")


@check("properties", "the split is never worse than the parent", "The weighted impurity of the best split is at most the impurity of all the labels.")
def no_worse_than_parent(sub):
    rng = np.random.default_rng(1)
    for _ in range(4):
        X = rng.normal(size=(15, 3))
        y = rng.integers(0, 3, size=15)
        result = sub.best_split(X, y)
        true(result is not None, "best_split returned None for data with many values", "a split", result)
        true(result[2] <= sub.gini_impurity(y) + 1e-12, "the best split has a larger impurity than the parent", sub.gini_impurity(y), result[2])


@check("properties", "the result matches a search over every candidate", "Try each feature and each midpoint between sorted unique values. Keep the lowest weighted impurity.")
def matches_brute(sub):
    rng = np.random.default_rng(2)
    for _ in range(3):
        X = np.round(rng.normal(size=(12, 3)), 1)
        y = rng.integers(0, 2, size=12)
        check_split(sub.best_split(X, y), brute_best(X, y), "the best split")


@check("properties", "the result does not depend on the row order", "Sort the unique values of each feature. The order of the rows must not change the answer.")
def row_order(sub):
    rng = np.random.default_rng(3)
    X = rng.normal(size=(10, 2))
    y = rng.integers(0, 2, size=10)
    order = rng.permutation(10)
    check_split(sub.best_split(X[order], y[order]), sub.best_split(X, y), "the split of the shuffled rows")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    X = np.array([[3.0, 1.0], [1.0, 2.0], [2.0, 0.5]])
    y = np.array([1, 0, 1])
    saved_x, saved_y = X.copy(), y.copy()
    sub.gini_impurity(y)
    sub.split_impurity(X[:, 0], y, 1.5)
    sub.best_threshold(X[:, 0], y)
    sub.best_split(X, y)
    close(X, saved_x, rtol=0, atol=0, what="X after the calls")
    equal(y.tolist(), saved_y.tolist(), what="y after the calls")


@check("edge", "an empty set has impurity 0", "A set with no labels has no impurity. Return 0.0 and do not divide by 0.")
def empty_labels(sub):
    close(sub.gini_impurity(np.array([], dtype=int)), 0.0, what="the impurity of an empty set")


@check("edge", "constant features give no split", "A feature with one unique value has no midpoint. best_threshold returns None, and best_split skips that feature.")
def constant_features(sub):
    true(sub.best_threshold(np.array([3.0, 3.0, 3.0]), np.array([0, 1, 0])) is None, "best_threshold of a constant feature must be None", None, sub.best_threshold(np.array([3.0, 3.0, 3.0]), np.array([0, 1, 0])))
    check_split(sub.best_split(np.array([[1.0, 5.0]]), np.array([1])), None, "the split of one row")
    X = np.array([[7.0, 1.0], [7.0, 2.0], [7.0, 3.0], [7.0, 4.0]])
    check_split(sub.best_split(X, np.array([0, 0, 1, 1])), (1, 2.5, 0.0), "the split with a constant feature 0")


@check("edge", "ties between features go to the lowest feature", "When two features give the same impurity, keep the first feature. Replace the best only for an impurity that is lower by more than 1e-12.")
def feature_tie(sub):
    X = np.array([[1.0, 1.0], [2.0, 2.0], [3.0, 3.0], [4.0, 4.0]])
    check_split(sub.best_split(X, np.array([0, 0, 1, 1])), (0, 2.5, 0.0), "the split of two equal features")
    X = np.array([[1.0, 4.0], [2.0, 3.0], [3.0, 2.0], [4.0, 1.0]])
    check_split(sub.best_split(X, np.array([0, 1, 0, 1])), (0, 1.5, 0.3333333333333333), "the split of two mirrored features")


@check("edge", "repeated values and labels that are not 0 and 1", "Use the unique values of a feature for the midpoints. Labels can be any integers.")
def repeated_values(sub):
    x = np.array([1.0, 1.0, 1.0, 2.0, 2.0, 5.0])
    y = np.array([7, 7, 3, 3, 3, 3])
    result = sub.best_threshold(x, y)
    true(result is not None and len(result) == 2, "best_threshold must return a tuple (threshold, impurity)", (1.5, 0.2222222222222222), result)
    close(result[0], 1.5, what="the threshold")
    close(result[1], 0.2222222222222222, rtol=1e-9, what="the impurity")


@fixture("datasets")
def datasets(ref):
    rng = np.random.default_rng(42)
    for n, d, c, decimals in [(6, 1, 2, 1), (10, 2, 2, 0), (15, 3, 3, 1), (20, 4, 2, 0), (12, 5, 4, 2), (25, 2, 3, 0)]:
        X = np.round(rng.normal(size=(n, d)) * 3.0, decimals)
        y = rng.integers(0, c, size=n)
        thresholds = [ref.best_threshold(X[:, f], y) for f in range(d)]
        yield {"X": X, "y": y}, {"split": ref.best_split(X, y), "thresholds": thresholds}


@check("reference", "best thresholds match the reference", "Your best threshold for each feature agrees with the reference solution. Many features have repeated values and tied splits.")
def reference_thresholds(sub):
    for case, expected in fixtures("datasets"):
        for f, want in enumerate(expected["thresholds"]):
            got = sub.best_threshold(case["X"][:, f], case["y"])
            label = f"feature {f} of X with shape {case['X'].shape}"
            if want is None:
                true(got is None, f"best_threshold for {label} must be None", None, got)
                continue
            true(got is not None and len(got) == 2, f"best_threshold for {label} must return a tuple", want, got)
            close(got[0], want[0], rtol=1e-12, what=f"the threshold for {label}")
            close(got[1], want[1], rtol=1e-9, atol=1e-12, what=f"the impurity for {label}")


@check("reference", "best splits match the reference", "Your best split agrees with the reference solution on random data sets.")
def reference_splits(sub):
    for case, expected in fixtures("datasets"):
        check_split(sub.best_split(case["X"], case["y"]), expected["split"], f"the split of X with shape {case['X'].shape}")
