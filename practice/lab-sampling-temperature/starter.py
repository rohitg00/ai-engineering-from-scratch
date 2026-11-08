import numpy as np

from support import LOGITS, TARGET_ENTROPY, TEMPERATURES, TOP_P


def softmax_t(logits, temperature):
    raise NotImplementedError


def entropy_bits(probs):
    raise NotImplementedError


def sweep_temperature(logits, temperatures):
    raise NotImplementedError


def temperature_for_entropy(logits, target, lo=0.05, hi=10.0, iters=60):
    raise NotImplementedError


def kept_count(probs, p):
    raise NotImplementedError


def answers():
    raise NotImplementedError
