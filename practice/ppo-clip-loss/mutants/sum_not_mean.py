import numpy as np


def ratios(logp_new, logp_old):
    return np.exp(np.asarray(logp_new, dtype=float) - np.asarray(logp_old, dtype=float))


def clipped_mask(ratio, advantages, eps):
    return ((advantages > 0) & (ratio > 1 + eps)) | ((advantages < 0) & (ratio < 1 - eps))


def ppo_clip_loss(logp_new, logp_old, advantages, eps=0.2):
    advantages = np.asarray(advantages, dtype=float)
    ratio = ratios(logp_new, logp_old)
    surrogate = np.minimum(ratio * advantages, np.clip(ratio, 1 - eps, 1 + eps) * advantages)
    return float(-np.sum(surrogate))


def clip_fraction(logp_new, logp_old, advantages, eps=0.2):
    advantages = np.asarray(advantages, dtype=float)
    ratio = ratios(logp_new, logp_old)
    return float(np.mean(clipped_mask(ratio, advantages, eps)))


def ppo_clip_grad(logp_new, logp_old, advantages, eps=0.2):
    advantages = np.asarray(advantages, dtype=float)
    ratio = ratios(logp_new, logp_old)
    grad = np.where(clipped_mask(ratio, advantages, eps), 0.0, -ratio * advantages)
    return grad
