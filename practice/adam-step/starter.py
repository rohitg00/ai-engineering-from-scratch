import numpy as np


def init_adam_state(params):
    raise NotImplementedError


def adam_step(params, grads, state, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8, weight_decay=0.0):
    raise NotImplementedError
