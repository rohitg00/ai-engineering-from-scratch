import numpy as np

from support import LEARNING_RATES, STEPS, make_regression, train


def run_sweep(X, y, lrs, steps=STEPS):
    raise NotImplementedError


def is_diverged(losses):
    raise NotImplementedError


def best_lr(lrs, curves):
    raise NotImplementedError


def smallest_diverging_lr(lrs, curves):
    raise NotImplementedError


def stability_bound(X):
    raise NotImplementedError


def answers():
    raise NotImplementedError
