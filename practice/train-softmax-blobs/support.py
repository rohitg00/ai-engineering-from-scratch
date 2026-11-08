import numpy as np

CENTERS = np.array([[1.0, 1.0], [5.0, 1.0], [3.0, 5.0], [7.0, 5.0]])


def make_blobs(n, rng, std=0.9, weights=None):
    y = rng.choice(len(CENTERS), size=n, p=weights)
    X = CENTERS[y] + rng.normal(scale=std, size=(n, 2))
    return X, y
