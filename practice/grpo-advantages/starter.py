import numpy as np


def group_advantages(rewards, eps=1e-8):
    raise NotImplementedError


def kl_k3(logp, ref_logp):
    raise NotImplementedError


def grpo_objective(logp, old_logp, ref_logp, advantages, mask, clip_eps=0.2, beta=0.04):
    raise NotImplementedError
