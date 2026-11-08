import numpy as np


def make_sine(n, rng, noise=0.1):
    x = rng.uniform(-np.pi, np.pi, size=n)
    y = np.sin(x) + rng.normal(scale=noise, size=n)
    return x, y
