import numpy as np


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def causal_mask(T):
    return np.triu(np.ones((T, T), dtype=bool), k=1)


def scaled_dot_product_attention(Q, K, V, mask=None):
    dk = Q.shape[-1]
    scores = Q @ np.swapaxes(K, -1, -2) / np.sqrt(dk)
    weights = softmax(scores)
    if mask is not None:
        weights = np.where(mask, 0.0, weights)
    output = weights @ V
    return output, weights
