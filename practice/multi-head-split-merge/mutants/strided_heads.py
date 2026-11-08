import numpy as np


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def split_heads(x, n_heads):
    B, T, D = x.shape
    if D % n_heads != 0:
        raise ValueError("d_model is not divisible by n_heads")
    d_head = D // n_heads
    return x.reshape(B, T, d_head, n_heads).transpose(0, 3, 1, 2)


def merge_heads(x):
    B, H, T, d_head = x.shape
    return x.transpose(0, 2, 3, 1).reshape(B, T, H * d_head)


def multi_head_attention(x, w_q, w_k, w_v, w_o, n_heads):
    q = split_heads(x @ w_q, n_heads)
    k = split_heads(x @ w_k, n_heads)
    v = split_heads(x @ w_v, n_heads)
    d_head = q.shape[-1]
    scores = q @ np.swapaxes(k, -1, -2) / np.sqrt(d_head)
    weights = softmax(scores)
    concat = merge_heads(weights @ v)
    return concat @ w_o, weights
