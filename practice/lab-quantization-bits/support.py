import numpy as np

BITS = [2, 3, 4, 5, 6, 7, 8]
THRESHOLD = 0.05


def make_weights(seed=0, rows=64, cols=128, n_outliers=6, outlier=0.25):
    rng = np.random.default_rng(seed)
    weights = rng.normal(0.0, 0.02, size=(rows, cols))
    outlier_rows = rng.choice(rows, size=n_outliers, replace=False)
    outlier_cols = rng.integers(0, cols, size=n_outliers)
    signs = np.where(rng.random(n_outliers) < 0.5, -1.0, 1.0)
    weights[outlier_rows, outlier_cols] = signs * outlier * rng.uniform(0.8, 1.2, size=n_outliers)
    return weights
