import numpy as np


def dropout_forward(x, p, rng, training=True):
    if not training:
        return x.copy(), np.ones(x.shape, dtype=bool)
    mask = rng.random(x.shape) >= p
    return x * mask / p, mask


def dropout_backward(grad_output, mask, p):
    return grad_output * mask / (1 - p)
