import numpy as np


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def causal_mask(T):
    return np.triu(np.ones((T, T), dtype=bool), k=0)


def scaled_dot_product_attention(Q, K, V, mask=None):
    dk = Q.shape[-1]
    scores = Q @ np.swapaxes(K, -1, -2) / np.sqrt(dk)
    if mask is not None:
        scores = np.where(mask, -np.inf, scores)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
