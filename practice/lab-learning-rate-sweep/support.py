import numpy as np

LEARNING_RATES = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0]
STEPS = 100
BLOW_UP = 1e10


def make_regression(seed=0, n=64):
    rng = np.random.default_rng(seed)
    scales = np.array([1.0, 0.5, 2.0, 0.25])
    X = rng.normal(size=(n, scales.size)) * scales
    w = rng.normal(size=scales.size)
    y = X @ w + 0.1 * rng.normal(size=n)
    return X, y


def mse(X, y, w):
    residual = X @ w - y
    return float(np.mean(residual ** 2))


def train(X, y, lr, steps=STEPS):
    n = X.shape[0]
    w = np.zeros(X.shape[1])
    losses = []
    for t in range(steps + 1):
        loss = mse(X, y, w)
        if not np.isfinite(loss) or loss > BLOW_UP:
            losses.extend([np.inf] * (steps + 1 - len(losses)))
            break
        losses.append(loss)
        if t < steps:
            w = w - lr * (2.0 / n) * (X.T @ (X @ w - y))
    return np.array(losses)
