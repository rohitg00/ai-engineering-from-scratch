import numpy as np

from practice_check import report
from support import make_spirals

SIZES = [2, 24, 24, 1]
STEPS = 1500
BATCH_SIZE = 64
LR = 0.01
BETA1 = 0.9
BETA2 = 0.999
EPS = 1e-8


def init_params(rng):
    params = []
    for fan_in, fan_out in zip(SIZES[:-1], SIZES[1:]):
        params.append(rng.normal(scale=np.sqrt(1.0 / fan_in), size=(fan_in, fan_out)))
        params.append(np.zeros(fan_out))
    return params


def forward(params, X):
    W1, b1, W2, b2, W3, b3 = params
    h1 = np.tanh(X @ W1 + b1)
    h2 = np.tanh(h1 @ W2 + b2)
    return h1, h2, h2 @ W3 + b3


def gradients(params, X, t):
    W1, b1, W2, b2, W3, b3 = params
    h1, h2, z = forward(params, X)
    p = 1.0 / (1.0 + np.exp(-z))
    loss = -np.mean(t * np.log(p + 1e-12) + (1.0 - t) * np.log(1.0 - p + 1e-12))
    dz = (p - t) / X.shape[0]
    d2 = dz @ W3.T * (1.0 - h2 ** 2)
    d1 = d2 @ W2.T * (1.0 - h1 ** 2)
    grads = [X.T @ d1, d1.sum(axis=0), h1.T @ d2, d2.sum(axis=0), h2.T @ dz, dz.sum(axis=0)]
    return loss, grads


def train(X, y, rng):
    params = init_params(rng)
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    t = y.astype(float).reshape(-1, 1)
    n = X.shape[0]
    order = np.arange(n)
    pos = n
    for step in range(STEPS):
        if pos + BATCH_SIZE > n:
            order = rng.permutation(n)
            pos = 0
        batch = order[pos:pos + BATCH_SIZE]
        pos += BATCH_SIZE
        loss, grads = gradients(params, X[batch], t[batch])
        report(step, float(loss))
        for i, g in enumerate(grads):
            m[i] = BETA1 * m[i] + (1.0 - BETA1) * g
            v[i] = BETA2 * v[i] + (1.0 - BETA2) * g ** 2
            m_hat = m[i] / (1.0 - BETA1 ** (step + 1))
            v_hat = v[i] / (1.0 - BETA2 ** (step + 1))
            params[i] = params[i] - LR * m_hat / (np.sqrt(v_hat) + EPS)
    return params


def predict(model, X):
    _, _, z = forward(model, np.asarray(X, dtype=float))
    return (z[:, 0] >= 0.0).astype(int)
