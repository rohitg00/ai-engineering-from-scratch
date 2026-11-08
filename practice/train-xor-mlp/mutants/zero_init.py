import numpy as np

from practice_check import report
from support import make_xor

SIZES = [2, 4, 1]
STEPS = 2000
LEARNING_RATE = 2.0


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))


def init_params(rng):
    params = []
    for n_in, n_out in zip(SIZES[:-1], SIZES[1:]):
        scale = np.sqrt(2.0 / n_in)
        params.append([np.zeros((n_in, n_out)), np.zeros(n_out)])
    return params


def forward(params, X):
    (W1, b1), (W2, b2) = params
    h = sigmoid(X @ W1 + b1)
    p = sigmoid(h @ W2 + b2)
    return h, p


def train(X, y, rng):
    params = init_params(rng)
    (W1, b1), (W2, b2) = params
    t = y.reshape(-1, 1).astype(float)
    n = X.shape[0]
    for step in range(STEPS):
        h, p = forward(params, X)
        loss = np.mean((p - t) ** 2)
        report(step, float(loss))
        dz2 = 2.0 * (p - t) / n * p * (1.0 - p)
        dz1 = dz2 @ W2.T * h * (1.0 - h)
        W2 -= LEARNING_RATE * (h.T @ dz2)
        b2 -= LEARNING_RATE * dz2.sum(axis=0)
        W1 -= LEARNING_RATE * (X.T @ dz1)
        b1 -= LEARNING_RATE * dz1.sum(axis=0)
    return params


def predict(model, X):
    _, p = forward(model, np.asarray(X, dtype=float))
    return (p[:, 0] >= 0.5).astype(int)
