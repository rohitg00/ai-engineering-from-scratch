import numpy as np

TIE = 1e-12


def gini_impurity(labels):
    n = len(labels)
    if n == 0:
        return 0.0
    _, counts = np.unique(labels, return_counts=True)
    return float(1.0 - np.sum((counts / n) ** 2))


def split_impurity(x, y, threshold):
    left = y[x <= threshold]
    right = y[x > threshold]
    n = len(y)
    return len(left) / n * gini_impurity(left) + len(right) / n * gini_impurity(right)


def best_threshold(x, y):
    values = np.unique(x)
    best = None
    for i in range(len(values) - 1):
        threshold = float(values[i])
        impurity = split_impurity(x, y, threshold)
        if best is None or impurity < best[1] - TIE:
            best = (threshold, impurity)
    return best


def best_split(X, y):
    best = None
    for feature in range(X.shape[1]):
        found = best_threshold(X[:, feature], y)
        if found is None:
            continue
        if best is None or found[1] < best[2] - TIE:
            best = (feature, found[0], found[1])
    return best
