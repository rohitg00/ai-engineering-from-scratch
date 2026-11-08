import numpy as np


def make_schedule(T, beta_start=1e-4, beta_end=0.02):
    betas = beta_start + (beta_end - beta_start) * np.arange(T) / (T - 1)
    alphas = 1.0 - betas
    alpha_bars = np.cumprod(alphas)
    return betas, alphas, alpha_bars


def extract(values, t, ndim):
    out = np.asarray(values)[t]
    if np.ndim(t) == 0:
        return out
    return out


def q_sample(x0, t, alpha_bars, noise):
    a_bar = extract(alpha_bars, t, np.ndim(x0))
    return np.sqrt(a_bar) * x0 + np.sqrt(1.0 - a_bar) * noise


def posterior_mean_variance(x0, x_t, t, betas, alpha_bars):
    alpha_bars_prev = np.concatenate([[1.0], alpha_bars[:-1]])
    ndim = np.ndim(x0)
    beta_t = extract(betas, t, ndim)
    a_bar = extract(alpha_bars, t, ndim)
    a_bar_prev = extract(alpha_bars_prev, t, ndim)
    coef_x0 = np.sqrt(a_bar_prev) * beta_t / (1.0 - a_bar)
    coef_xt = np.sqrt(1.0 - beta_t) * (1.0 - a_bar_prev) / (1.0 - a_bar)
    mean = coef_x0 * x0 + coef_xt * x_t
    variance = (1.0 - a_bar_prev) / (1.0 - a_bar) * beta_t
    return mean, variance
