import numpy as np


def softmax(logits):
    logits -= np.max(logits, axis=1, keepdims=True)
    exps = np.exp(logits)
    return exps / np.sum(exps, axis=1, keepdims=True)


def cross_entropy(logits, targets):
    log_probs = np.log(softmax(logits.copy()))
    rows = np.arange(logits.shape[0])
    return float(-np.mean(log_probs[rows, targets]))


def cross_entropy_grad(logits, targets):
    grad = softmax(logits.copy())
    rows = np.arange(logits.shape[0])
    grad[rows, targets] -= 1.0
    return grad / logits.shape[0]
