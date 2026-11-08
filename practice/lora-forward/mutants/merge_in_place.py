import numpy as np


def lora_forward(x, W, b, A, B, alpha):
    rank = A.shape[0]
    scaling = alpha / rank
    base = x @ W.T + b
    return base + scaling * ((x @ A.T) @ B.T)


def merge_lora(W, A, B, alpha):
    rank = A.shape[0]
    scaling = alpha / rank
    W += scaling * (B @ A)
    return W


def count_trainable(in_features, out_features, rank):
    return rank * in_features + out_features * rank
