import numpy as np


def make_schedule(T, beta_start=1e-4, beta_end=0.02):
    raise NotImplementedError


def q_sample(x0, t, alpha_bars, noise):
    raise NotImplementedError


def posterior_mean_variance(x0, x_t, t, betas, alpha_bars):
    raise NotImplementedError
