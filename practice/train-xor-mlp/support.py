import numpy as np


def make_xor(n, rng, noise=0.15):
    corners = rng.integers(0, 2, size=(n, 2))
    X = corners + rng.normal(scale=noise, size=(n, 2))
    y = (corners[:, 0] ^ corners[:, 1]).astype(int)
    return X, y
