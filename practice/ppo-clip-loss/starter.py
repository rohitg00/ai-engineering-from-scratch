import numpy as np


def ppo_clip_loss(logp_new, logp_old, advantages, eps=0.2):
    raise NotImplementedError


def clip_fraction(logp_new, logp_old, advantages, eps=0.2):
    raise NotImplementedError


def ppo_clip_grad(logp_new, logp_old, advantages, eps=0.2):
    raise NotImplementedError
