import numpy as np


def top_k_filter(logits, k):
    raise NotImplementedError


def top_p_filter(logits, p):
    raise NotImplementedError


def sampling_probs(logits, temperature=1.0, top_k=None, top_p=None):
    raise NotImplementedError


def sample(logits, rng, temperature=1.0, top_k=None, top_p=None):
    raise NotImplementedError
