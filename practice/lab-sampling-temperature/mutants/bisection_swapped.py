import numpy as np

from support import LOGITS, TARGET_ENTROPY, TEMPERATURES, TOP_P


def softmax_t(logits, temperature):
    scaled = np.asarray(logits, dtype=float) / temperature
    exps = np.exp(scaled - np.max(scaled))
    return exps / np.sum(exps)


def entropy_bits(probs):
    probs = np.asarray(probs, dtype=float)
    nonzero = probs[probs > 0]
    return float(-np.sum(nonzero * np.log2(nonzero)))


def sweep_temperature(logits, temperatures):
    entropies = []
    top1 = []
    for t in temperatures:
        probs = softmax_t(logits, t)
        entropies.append(entropy_bits(probs))
        top1.append(float(np.max(probs)))
    return np.array(entropies), np.array(top1)


def temperature_for_entropy(logits, target, lo=0.05, hi=10.0, iters=60):
    for _ in range(iters):
        mid = (lo + hi) / 2
        if entropy_bits(softmax_t(logits, mid)) < target:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def kept_count(probs, p):
    ordered = np.sort(np.asarray(probs, dtype=float))[::-1]
    cum = np.cumsum(ordered)
    for i, c in enumerate(cum):
        if c >= p:
            return i + 1
    return len(ordered)


def answers():
    entropies, top1 = sweep_temperature(LOGITS, TEMPERATURES)
    first = next(t for t, h in zip(TEMPERATURES, entropies) if h >= TARGET_ENTROPY)
    return {
        "entropy_t1": entropy_bits(softmax_t(LOGITS, 1.0)),
        "top1_t07": float(np.max(softmax_t(LOGITS, 0.7))),
        "first_grid_temperature": float(first),
        "crossing_temperature": temperature_for_entropy(LOGITS, TARGET_ENTROPY),
        "kept_p09_t07": float(kept_count(softmax_t(LOGITS, 0.7), TOP_P)),
        "kept_p09_t10": float(kept_count(softmax_t(LOGITS, 1.0), TOP_P)),
        "kept_p09_t15": float(kept_count(softmax_t(LOGITS, 1.5), TOP_P)),
    }
