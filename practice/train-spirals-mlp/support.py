import numpy as np


def make_spirals(n, rng, noise=0.08, turns=2.0):
    half = n // 2
    y = np.repeat([0, 1], [half, n - half])
    t = np.sqrt(rng.uniform(size=n)) * turns * 2.0 * np.pi
    radius = 3.0 * t / (turns * 2.0 * np.pi)
    angle = t + np.pi * y
    X = np.stack([radius * np.cos(angle), radius * np.sin(angle)], axis=1)
    X = X + rng.normal(scale=noise, size=(n, 2))
    return X, y
