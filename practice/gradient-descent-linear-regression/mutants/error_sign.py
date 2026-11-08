import numpy as np


def predict(X, w, b):
    return X @ w + b


def compute_cost(X, y, w, b):
    errors = predict(X, w, b) - y
    return float(np.mean(errors ** 2))


def compute_gradients(X, y, w, b):
    n = len(y)
    errors = y - predict(X, w, b)
    dw = (2 / n) * (X.T @ errors)
    db = (2 / n) * float(np.sum(errors))
    return dw, db


def fit(X, y, learning_rate, epochs):
    w = np.zeros(X.shape[1])
    b = 0.0
    cost_history = []
    for _ in range(epochs):
        dw, db = compute_gradients(X, y, w, b)
        w = w - learning_rate * dw
        b = b - learning_rate * db
        cost_history.append(compute_cost(X, y, w, b))
    return w, b, cost_history
