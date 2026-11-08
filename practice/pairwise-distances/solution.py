import numpy as np


def pairwise_sq_distances(A, B):
    a_sq = np.sum(A ** 2, axis=1)[:, None]
    b_sq = np.sum(B ** 2, axis=1)[None, :]
    sq = a_sq + b_sq - 2.0 * (A @ B.T)
    return np.maximum(sq, 0.0)


def pairwise_distances(A, B):
    return np.sqrt(pairwise_sq_distances(A, B))


def cosine_similarity_matrix(A, B):
    norm_a = np.linalg.norm(A, axis=1)[:, None]
    norm_b = np.linalg.norm(B, axis=1)[None, :]
    denom = norm_a * norm_b
    dots = A @ B.T
    safe = np.where(denom == 0, 1.0, denom)
    return np.where(denom == 0, 0.0, dots / safe)
