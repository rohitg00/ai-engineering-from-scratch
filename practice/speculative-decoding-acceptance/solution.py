import numpy as np


def acceptance_rate(target, draft):
    return float(np.sum(np.minimum(target, draft)))


def residual_distribution(target, draft):
    raw = np.maximum(0.0, np.asarray(target, dtype=float) - np.asarray(draft, dtype=float))
    total = np.sum(raw)
    if total == 0.0:
        return np.array(target, dtype=float)
    return raw / total


def speculative_step(target_probs, draft_probs, draft_tokens, rng):
    out = []
    for i, token in enumerate(draft_tokens):
        p = target_probs[i][token]
        q = draft_probs[i][token]
        if rng.random() < min(1.0, p / q):
            out.append(int(token))
        else:
            residual = residual_distribution(target_probs[i], draft_probs[i])
            out.append(int(rng.choice(len(residual), p=residual)))
            return out
    last = target_probs[len(draft_tokens)]
    out.append(int(rng.choice(len(last), p=last)))
    return out


def expected_tokens(alpha, gamma):
    if alpha >= 1.0:
        return float(gamma + 1)
    return float((1.0 - alpha ** (gamma + 1)) / (1.0 - alpha))
