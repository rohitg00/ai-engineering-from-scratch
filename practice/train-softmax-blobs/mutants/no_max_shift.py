import numpy as np

from practice_check import report
from support import CENTERS, make_blobs

N_CLASSES = 4
STEPS = 500
LEARNING_RATE = 2.0


def softmax(scores):
    shifted = scores
    exp_scores = np.exp(shifted)
    return exp_scores / np.sum(exp_scores, axis=1, keepdims=True)


def train(X, y, rng):
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    Z = (X - mean) / std
    n, n_features = Z.shape
    weights = np.zeros((n_features, N_CLASSES))
    biases = np.zeros(N_CLASSES)
    targets = np.eye(N_CLASSES)[y]
    for step in range(STEPS):
        probs = softmax(Z @ weights + biases)
        loss = -np.mean(np.log(np.maximum(probs[np.arange(n), y], 1e-15)))
        report(step, float(loss))
        error = (probs - targets) / n
        weights -= LEARNING_RATE * (Z.T @ error)
        biases -= LEARNING_RATE * error.sum(axis=0)
    return {"mean": mean, "std": std, "weights": weights, "biases": biases}


def predict_proba(model, X):
    Z = (np.asarray(X, dtype=float) - model["mean"]) / model["std"]
    return softmax(Z @ model["weights"] + model["biases"])
