import numpy as np


def batchnorm_forward(x, gamma, beta, running_mean, running_var, momentum=0.1, eps=1e-5, training=True):
    raise NotImplementedError


def batchnorm_backward(grad_output, cache):
    raise NotImplementedError
