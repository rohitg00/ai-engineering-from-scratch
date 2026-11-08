import numpy as np


def interpolate(x0, x1, t):
    raise NotImplementedError


def target_velocity(x0, x1):
    raise NotImplementedError


def flow_matching_loss(velocity_fn, x0, x1, t):
    raise NotImplementedError


def euler_sample(velocity_fn, x0, num_steps):
    raise NotImplementedError
