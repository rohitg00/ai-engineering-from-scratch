import numpy as np


def binary_parts(logits, targets, alpha):
    sign = 2.0 * np.asarray(targets, dtype=float) - 1.0
    s = sign * np.asarray(logits, dtype=float)
    log_pt = -np.logaddexp(0.0, -s)
    one_minus_pt = np.exp(-np.logaddexp(0.0, s))
    alpha_t = 1.0 if alpha is None else np.where(sign > 0, alpha, 1.0 - alpha)
    return sign, log_pt, one_minus_pt, alpha_t


def binary_focal_loss(logits, targets, gamma=2.0, alpha=None):
    _, log_pt, one_minus_pt, alpha_t = binary_parts(logits, targets, alpha)
    return float(np.mean(-alpha_t * one_minus_pt ** gamma * log_pt))


def binary_focal_grad(logits, targets, gamma=2.0, alpha=None):
    sign, log_pt, one_minus_pt, alpha_t = binary_parts(logits, targets, alpha)
    pt = np.exp(log_pt)
    d_s = alpha_t * one_minus_pt ** gamma * (gamma * pt * log_pt - one_minus_pt)
    return d_s * sign / sign.size


def focal_loss(logits, targets, gamma=2.0, alpha=None):
    logits = np.asarray(logits, dtype=float)
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_probs = shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))
    log_pt = log_probs[np.arange(logits.shape[0]), targets]
    alpha_t = 1.0
    return float(np.mean(-alpha_t * (1.0 - np.exp(log_pt)) ** gamma * log_pt))
