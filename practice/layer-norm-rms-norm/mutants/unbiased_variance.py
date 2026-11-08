import numpy as np


def layer_norm(x, gamma, beta, eps=1e-5):
    mean = np.mean(x, axis=-1, keepdims=True)
    var = np.var(x, axis=-1, keepdims=True, ddof=1)
    return (x - mean) / np.sqrt(var + eps) * gamma + beta


def rms_norm(x, weight, eps=1e-6):
    rms = np.sqrt(np.mean(x * x, axis=-1, keepdims=True) + eps)
    return x / rms * weight
