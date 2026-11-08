import numpy as np


def acceptance_rate(target, draft):
    raise NotImplementedError


def residual_distribution(target, draft):
    raise NotImplementedError


def speculative_step(target_probs, draft_probs, draft_tokens, rng):
    raise NotImplementedError


def expected_tokens(alpha, gamma):
    raise NotImplementedError
