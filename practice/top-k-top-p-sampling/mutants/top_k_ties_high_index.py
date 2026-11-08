import numpy as np


def softmax(logits):
    shifted = logits - np.max(logits)
    exps = np.exp(shifted)
    return exps / np.sum(exps)


def top_k_filter(logits, k):
    order = np.argsort(logits)[::-1]
    keep = order[:k]
    out = np.full(logits.shape, -np.inf)
    out[keep] = logits[keep]
    return out


def top_p_filter(logits, p):
    probs = softmax(logits)
    order = np.argsort(-probs, kind="stable")
    cum = np.cumsum(probs[order])
    cutoff = len(order)
    for i in range(len(order)):
        if cum[i] >= p:
            cutoff = i + 1
            break
    keep = order[:cutoff]
    out = np.full(logits.shape, -np.inf)
    out[keep] = logits[keep]
    return out


def sampling_probs(logits, temperature=1.0, top_k=None, top_p=None):
    scaled = np.asarray(logits, dtype=float) / temperature
    if top_k is not None:
        scaled = top_k_filter(scaled, top_k)
    if top_p is not None:
        scaled = top_p_filter(scaled, top_p)
    return softmax(scaled)


def sample(logits, rng, temperature=1.0, top_k=None, top_p=None):
    probs = sampling_probs(logits, temperature, top_k, top_p)
    u = rng.random()
    cum = np.cumsum(probs)
    for i in range(len(cum)):
        if u < cum[i]:
            return i
    return int(np.nonzero(probs)[0][-1])
