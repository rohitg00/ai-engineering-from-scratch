import numpy as np


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exps = np.exp(shifted)
    return exps / np.sum(exps, axis=-1, keepdims=True)


def route(logits, top_k):
    order = np.argsort(-logits, axis=-1, kind="stable")
    top_idx = order[:, :top_k]
    chosen = np.take_along_axis(logits, top_idx, axis=-1)
    gates = np.take_along_axis(softmax(logits), top_idx, axis=-1)
    return top_idx, gates


def load_balancing_loss(logits, top_k):
    T, E = logits.shape
    top_idx, _ = route(logits, top_k)
    counts = np.bincount(top_idx.reshape(-1), minlength=E)
    f = counts / (T * top_k)
    P = np.mean(softmax(logits), axis=0)
    return float(E * np.sum(f * P))
