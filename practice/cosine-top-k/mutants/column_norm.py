import numpy as np


def normalize_rows(X):
    norms = np.linalg.norm(X, axis=0, keepdims=True)
    safe = np.where(norms > 0, norms, 1.0)
    return X / safe


def cosine_similarity_matrix(Q, D):
    return normalize_rows(Q) @ normalize_rows(D).T


def top_k(Q, D, k):
    scores = cosine_similarity_matrix(Q, D)
    order = np.argsort(-scores, axis=1, kind="stable")
    return order[:, :k]
