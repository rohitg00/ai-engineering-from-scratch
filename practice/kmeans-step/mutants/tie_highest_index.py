import numpy as np


def assign(X, centroids):
    diffs = X[:, None, :] - centroids[None, :, :]
    distances = np.sum(diffs ** 2, axis=2)
    k = distances.shape[1]
    return k - 1 - np.argmin(distances[:, ::-1], axis=1)


def update(X, assignments, centroids):
    new_centroids = np.array(centroids, dtype=float)
    for j in range(len(centroids)):
        members = X[assignments == j]
        if len(members) > 0:
            new_centroids[j] = members.mean(axis=0)
    return new_centroids


def kmeans(X, init_centroids, max_iterations=100):
    centroids = np.array(init_centroids, dtype=float)
    assignments = assign(X, centroids)
    for iteration in range(1, max_iterations + 1):
        centroids = update(X, assignments, centroids)
        new_assignments = assign(X, centroids)
        if np.array_equal(new_assignments, assignments):
            return centroids, new_assignments, iteration
        assignments = new_assignments
    return centroids, assignments, max_iterations
