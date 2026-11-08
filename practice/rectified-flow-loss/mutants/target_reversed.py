import numpy as np


def expand(t, ndim):
    t = np.asarray(t, dtype=float)
    if t.ndim == 0:
        return t
    return t.reshape((-1,) + (1,) * (ndim - 1))


def interpolate(x0, x1, t):
    t = expand(t, np.ndim(x0))
    return (1.0 - t) * x0 + t * x1


def target_velocity(x0, x1):
    return x0 - x1


def flow_matching_loss(velocity_fn, x0, x1, t):
    x_t = interpolate(x0, x1, t)
    diff = velocity_fn(x_t, t) - target_velocity(x0, x1)
    per_sample = np.sum(diff.reshape(diff.shape[0], -1) ** 2, axis=1)
    return float(np.mean(per_sample))


def euler_sample(velocity_fn, x0, num_steps):
    x = np.array(x0, dtype=float)
    dt = 1.0 / num_steps
    for k in range(num_steps):
        t = np.full(x.shape[0], k * dt)
        x = x + dt * velocity_fn(x, t)
    return x
