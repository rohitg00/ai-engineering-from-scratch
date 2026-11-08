import numpy as np


def softmax(logits):
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    exps = np.exp(shifted)
    return exps / np.sum(exps, axis=1, keepdims=True)


def cross_entropy(logits, targets):
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_probs = shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))
    rows = np.arange(logits.shape[0])
    return float(-np.mean(log_probs[rows, targets]))


def cross_entropy_grad(logits, targets):
    return softmax(logits) / logits.shape[0]
