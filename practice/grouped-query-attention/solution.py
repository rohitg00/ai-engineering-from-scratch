import numpy as np


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def split_heads(x, n_heads):
    B, T, D = x.shape
    return x.reshape(B, T, n_heads, D // n_heads).transpose(0, 2, 1, 3)


def merge_heads(x):
    B, H, T, d_head = x.shape
    return x.transpose(0, 2, 1, 3).reshape(B, T, H * d_head)


def repeat_kv(kv, n_heads):
    n_kv_heads = kv.shape[1]
    if n_heads % n_kv_heads != 0:
        raise ValueError("n_heads must be a multiple of n_kv_heads")
    return np.repeat(kv, n_heads // n_kv_heads, axis=1)


def grouped_query_attention(x, w_q, w_k, w_v, w_o, n_heads, n_kv_heads):
    if n_heads % n_kv_heads != 0:
        raise ValueError("n_heads must be a multiple of n_kv_heads")
    Q = split_heads(x @ w_q, n_heads)
    K = repeat_kv(split_heads(x @ w_k, n_kv_heads), n_heads)
    V = repeat_kv(split_heads(x @ w_v, n_kv_heads), n_heads)
    d_head = Q.shape[-1]
    scores = Q @ np.swapaxes(K, -1, -2) / np.sqrt(d_head)
    weights = softmax(scores)
    return merge_heads(weights @ V) @ w_o, weights


def mean_pool_kv_heads(w, n_heads, n_kv_heads):
    if n_heads % n_kv_heads != 0:
        raise ValueError("n_heads must be a multiple of n_kv_heads")
    D, width = w.shape
    d_head = width // n_heads
    grouped = w.reshape(D, n_kv_heads, n_heads // n_kv_heads, d_head)
    return grouped.mean(axis=2).reshape(D, n_kv_heads * d_head)
