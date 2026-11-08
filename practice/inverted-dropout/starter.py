import numpy as np


def dropout_forward(x, p, rng, training=True):
    raise NotImplementedError


def dropout_backward(grad_output, mask, p):
    raise NotImplementedError
