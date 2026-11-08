import numpy as np


def sigmoid(z):
    z = np.asarray(z, dtype=float)
    e = np.exp(-np.abs(z))
    return np.where(z >= 0, 1.0 / (1.0 + e), e / (1.0 + e))


def compute_loss(X, y, w, b):
    z = X @ w + b
    return float(np.mean(np.logaddexp(0.0, z) - y * z))


def compute_gradients(X, y, w, b):
    n = len(y)
    errors = sigmoid(X @ w + b) - y
    dw = (X.T @ errors) / n
    db = float(np.sum(errors)) / n
    return dw, db


def fit(X, y, learning_rate, epochs):
    w = np.zeros(X.shape[1])
    b = 0.0
    loss_history = []
    for _ in range(epochs):
        dw, db = compute_gradients(X, y, w, b)
        loss_history.append(compute_loss(X, y, w, b))
        w = w - learning_rate * dw
        b = b - learning_rate * db
    return w, b, loss_history
