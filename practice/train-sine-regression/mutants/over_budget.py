import numpy as np

from practice_check import report
from support import make_sine

HIDDEN = 16
STEPS = 2500
LR = 0.01
BETA1 = 0.9
BETA2 = 0.999
EPS = 1e-8


def init_params(rng):
    W1 = rng.normal(scale=1.0, size=(1, HIDDEN))
    W2 = rng.normal(scale=np.sqrt(1.0 / HIDDEN), size=(HIDDEN, 1))
    return [W1, np.zeros(HIDDEN), W2, np.zeros(1)]


def forward(params, X):
    W1, b1, W2, b2 = params
    h = np.tanh(X @ W1 + b1)
    return h, h @ W2 + b2


def train(x, y, rng):
    params = init_params(rng)
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    X = x.reshape(-1, 1)
    t = y.reshape(-1, 1)
    n = X.shape[0]
    for step in range(STEPS):
        W1, b1, W2, b2 = params
        h, out = forward(params, X)
        loss = np.mean((out - t) ** 2)
        report(step, float(loss))
        d_out = 2.0 * (out - t) / n
        d_h = d_out @ W2.T * (1.0 - h ** 2)
        grads = [X.T @ d_h, d_h.sum(axis=0), h.T @ d_out, d_out.sum(axis=0)]
        for i, g in enumerate(grads):
            m[i] = BETA1 * m[i] + (1.0 - BETA1) * g
            v[i] = BETA2 * v[i] + (1.0 - BETA2) * g ** 2
            m_hat = m[i] / (1.0 - BETA1 ** (step + 1))
            v_hat = v[i] / (1.0 - BETA2 ** (step + 1))
            params[i] = params[i] - LR * m_hat / (np.sqrt(v_hat) + EPS)
    return params


def predict(model, x):
    _, out = forward(model, np.asarray(x, dtype=float).reshape(-1, 1))
    return out[:, 0]
