import numpy as np


def softmax(logits):
    exps = np.exp(logits - np.max(logits))
    return exps / np.sum(exps)


def cross_entropy(logits, targets):
    probs = softmax(logits)
    rows = np.arange(logits.shape[0])
    return float(-np.mean(np.log(probs[rows, targets])))


def cross_entropy_grad(logits, targets):
    grad = softmax(logits)
    rows = np.arange(logits.shape[0])
    grad[rows, targets] -= 1.0
    return grad / logits.shape[0]
