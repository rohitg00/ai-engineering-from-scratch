import numpy as np


def group_advantages(rewards, eps=1e-8):
    mean_r = np.mean(rewards, axis=-1, keepdims=True)
    std_r = np.std(rewards, axis=-1, keepdims=True)
    return (rewards - mean_r) / (std_r + eps)


def kl_k3(logp, ref_logp):
    log_ratio = ref_logp - logp
    return np.exp(log_ratio) - log_ratio - 1.0


def grpo_objective(logp, old_logp, ref_logp, advantages, mask, clip_eps=0.2, beta=0.04):
    ratio = np.exp(logp - old_logp)
    adv = advantages[:, None]
    unclipped = ratio * adv
    clipped = np.clip(ratio, 1.0 - clip_eps, 1.0 + clip_eps) * adv
    per_token = np.minimum(unclipped, clipped) - beta * kl_k3(logp, ref_logp)
    mask = mask.astype(float)
    return float(np.sum(per_token * mask) / np.sum(mask))
    return float(np.mean(per_seq))
