import numpy as np


def sigmoid(z):
    z = np.clip(z, -500, 500)
    return 1.0 / (1.0 + np.exp(-z))


def mlp_forward(x, params):
    z1 = x @ params["W1"] + params["b1"]
    a1 = sigmoid(z1)
    z2 = a1 @ params["W2"] + params["b2"]
    a2 = sigmoid(z2)
    cache = {"x": x, "a1": a1, "a2": a2}
    return a2, cache


def mse_loss(predicted, target):
    return float(np.mean((predicted - target) ** 2))


def mlp_backward(params, cache, target):
    x, a1, a2 = cache["x"], cache["a1"], cache["a2"]
    d_a2 = (a2 - target) / a2.size
    d_z2 = d_a2 * a2 * (1 - a2)
    d_W2 = a1.T @ d_z2
    d_b2 = np.sum(d_z2, axis=0)
    d_a1 = d_z2 @ params["W2"].T
    d_z1 = d_a1 * a1 * (1 - a1)
    d_W1 = x.T @ d_z1
    d_b1 = np.sum(d_z1, axis=0)
    return {"W1": d_W1, "b1": d_b1, "W2": d_W2, "b2": d_b2}
