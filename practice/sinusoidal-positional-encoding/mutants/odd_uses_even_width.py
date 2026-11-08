import numpy as np


def sinusoidal_pe(max_len, d_model, base=10000.0):
    pe = np.zeros((max_len, d_model))
    half = d_model // 2
    pos = np.arange(max_len)[:, None]
    i = np.arange(half)[None, :]
    theta = pos / (base ** (2 * i / (2 * half)))
    pe[:, 0:2 * half:2] = np.sin(theta)
    pe[:, 1:2 * half:2] = np.cos(theta)
    return pe


def add_positional_encoding(x, base=10000.0):
    x = np.asarray(x, dtype=float)
    T, d = x.shape[-2], x.shape[-1]
    return x + sinusoidal_pe(T, d, base)
