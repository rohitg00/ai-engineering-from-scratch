import numpy as np


def rope_frequencies(d, base=10000.0):
    i = np.arange(d // 2)
    return 1.0 / (base ** (2 * i / d))


def apply_rope(x, positions, base=10000.0):
    x = np.asarray(x, dtype=float)
    d = x.shape[-1]
    half = d // 2
    theta = np.asarray(positions, dtype=float)[:, None] * rope_frequencies(d, base)[None, :]
    c = np.cos(theta)
    s = np.sin(theta)
    a = x[..., 0:half]
    b = x[..., half:2 * half]
    out = x.copy()
    out[..., 0:half] = a * c - b * s
    out[..., half:2 * half] = a * s + b * c
    return out
