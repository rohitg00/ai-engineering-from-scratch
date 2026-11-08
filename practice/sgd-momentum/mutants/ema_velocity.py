import numpy as np


def momentum_step(params, grads, velocity, lr=0.01, beta=0.9):
    new_velocity = beta * velocity + (1 - beta) * grads
    new_params = params - lr * new_velocity
    return new_params, new_velocity


def minimize_quadratic(A, b, x0, lr=0.1, beta=0.9, steps=50, nesterov=False):
    x = np.array(x0, dtype=float)
    velocity = np.zeros_like(x)
    trajectory = [x.copy()]
    for _ in range(steps):
        point = x - lr * beta * velocity if nesterov else x
        grad = A @ point - b
        x, velocity = momentum_step(x, grad, velocity, lr, beta)
        trajectory.append(x.copy())
    return np.array(trajectory)
