import numpy as np


def momentum_step(params, grads, velocity, lr=0.01, beta=0.9):
    raise NotImplementedError


def minimize_quadratic(A, b, x0, lr=0.1, beta=0.9, steps=50, nesterov=False):
    raise NotImplementedError
