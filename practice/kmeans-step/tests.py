import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

X_EX = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [5.0, 5.0], [6.0, 5.0], [5.0, 6.0]])
C_EX = np.array([[0.0, 0.0], [1.0, 1.0]])
X_LINE = np.array([[0.0], [1.0], [2.0], [10.0], [11.0], [12.0], [20.0]])
C_LINE = np.array([[0.0], [1.0], [2.0]])


def blobs(seed, n_per, k, d):
    rng = np.random.default_rng(seed)
    centers = rng.normal(size=(k, d)) * 6.0
    return np.vstack([c + rng.normal(size=(n_per, d)) for c in centers])


def inertia(X, assignments, centroids):
    return float(np.sum((X - centroids[assignments]) ** 2))


@check("examples", "assignment step with a tie", "Each point goes to the centroid with the smallest squared distance. The points [1, 0] and [0, 1] are at the same distance from both centroids, so they go to the lower index 0.")
def example_assign(sub):
    equal(np.asarray(sub.assign(X_EX.copy(), C_EX.copy())).tolist(), [0, 0, 0, 1, 1, 1], what="the assignments")


@check("examples", "update step", "Each new centroid is the mean of the points that are assigned to it.")
def example_update(sub):
    result = sub.update(X_EX.copy(), np.array([0, 0, 0, 1, 1, 1]), C_EX.copy())
    close(result, [[0.33333333, 0.33333333], [5.33333333, 5.33333333]], rtol=1e-7, what="the new centroids")


@check("examples", "a full run on points on a line", "Alternate update and assignment. Stop when the assignments do not change, and return the number of update steps.")
def example_kmeans(sub):
    centroids, assignments, iters = sub.kmeans(X_LINE.copy(), C_LINE.copy())
    close(centroids, [[0.0], [1.5], [13.25]], what="the final centroids")
    equal(np.asarray(assignments).tolist(), [0, 1, 1, 2, 2, 2, 2], what="the final assignments")
    equal(int(iters), 2, what="the number of iterations")


@check("properties", "assignments match a loop over the points", "The assignment of each point is the index of its nearest centroid by Euclidean distance.")
def assign_matches_loop(sub):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(30, 3))
    C = rng.normal(size=(5, 3))
    result = np.asarray(sub.assign(X, C))
    shape(result, (30,), what="the assignments")
    expected = [int(np.argmin([np.sum((x - c) ** 2) for c in C])) for x in X]
    equal(result.tolist(), expected, what="the assignments")


@check("properties", "the final state is consistent", "At the end, each point is assigned to its nearest final centroid, and each centroid with points is the mean of its points.")
def final_consistent(sub):
    X = blobs(1, 15, 3, 2)
    rng = np.random.default_rng(11)
    init = X[rng.choice(len(X), size=3, replace=False)]
    centroids, assignments, _ = sub.kmeans(X, init)
    assignments = np.asarray(assignments)
    equal(np.asarray(sub.assign(X, centroids)).tolist(), assignments.tolist(), what="assign(X, final centroids)")
    for j in range(3):
        members = X[assignments == j]
        if len(members):
            close(centroids[j], members.mean(axis=0), rtol=1e-9, what=f"centroid {j}")


@check("properties", "each step does not increase the inertia", "The assignment step and the update step each lower the sum of squared distances or keep it the same.")
def inertia_falls(sub):
    X = blobs(2, 12, 4, 3)
    centroids = X[:4].copy()
    assignments = np.asarray(sub.assign(X, centroids))
    previous = inertia(X, assignments, centroids)
    for _ in range(6):
        centroids = np.asarray(sub.update(X, assignments, centroids))
        after_update = inertia(X, assignments, centroids)
        assignments = np.asarray(sub.assign(X, centroids))
        after_assign = inertia(X, assignments, centroids)
        true(after_update <= previous + 1e-9, "the update step increased the inertia", previous, after_update)
        true(after_assign <= after_update + 1e-9, "the assignment step increased the inertia", after_update, after_assign)
        previous = after_assign


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it. Return new arrays.")
def inputs_unchanged(sub):
    X = np.array([[0.0, 1.0], [2.0, 0.0], [9.0, 9.0], [8.0, 10.0]])
    C = np.array([[0.0, 0.0], [10.0, 10.0]])
    labels = np.array([0, 0, 1, 1])
    saved_x, saved_c, saved_l = X.copy(), C.copy(), labels.copy()
    sub.assign(X, C)
    sub.update(X, labels, C)
    sub.kmeans(X, C)
    close(X, saved_x, rtol=0, atol=0, what="X after the calls")
    close(C, saved_c, rtol=0, atol=0, what="the centroids after the calls")
    equal(labels.tolist(), saved_l.tolist(), what="the assignments after the calls")


@check("edge", "an empty cluster keeps its old centroid", "When no point is assigned to a centroid, the update step keeps that centroid as it was. A mean of no points is NaN.")
def empty_cluster(sub):
    C = np.array([[0.0, 0.0], [100.0, -100.0], [5.0, 5.0]])
    result = sub.update(X_EX.copy(), np.array([0, 0, 0, 2, 2, 2]), C.copy())
    close(result, [[0.33333333, 0.33333333], [100.0, -100.0], [5.33333333, 5.33333333]], rtol=1e-7, what="the new centroids")
    centroids, assignments, iters = sub.kmeans(X_EX.copy(), C)
    close(centroids[1], [100.0, -100.0], what="the far centroid after the run")
    equal(np.asarray(assignments).tolist(), [0, 0, 0, 2, 2, 2], what="the assignments")
    equal(int(iters), 1, what="the number of iterations")


@check("edge", "ties go to the lowest index", "When two centroids are at the same distance, np.argmin picks the first one. Any other order breaks the tie rule.")
def ties(sub):
    X = np.array([[0.0, 0.0], [2.0, 0.0], [1.0, 1.0]])
    C = np.array([[1.0, 0.0], [-1.0, 0.0], [1.0, 0.0]])
    equal(np.asarray(sub.assign(X, C)).tolist(), [0, 0, 0], what="the assignments")


@check("edge", "the run stops at max_iterations", "With max_iterations = 1, kmeans does one update step and returns 1, even when the assignments still change.")
def max_iterations(sub):
    centroids, assignments, iters = sub.kmeans(X_LINE.copy(), C_LINE.copy(), max_iterations=1)
    close(centroids, [[0.0], [1.0], [11.0]], what="the centroids")
    equal(np.asarray(assignments).tolist(), [0, 1, 1, 2, 2, 2, 2], what="the assignments to those centroids")
    equal(int(iters), 1, what="the number of iterations")


@check("edge", "one cluster", "With k = 1, every point goes to cluster 0 and the centroid is the mean of all points.")
def one_cluster(sub):
    centroids, assignments, iters = sub.kmeans(X_EX.copy(), np.array([[9.0, -9.0]]))
    close(centroids, [X_EX.mean(axis=0)], rtol=1e-9, what="the centroid")
    equal(np.asarray(assignments).tolist(), [0] * 6, what="the assignments")
    equal(int(iters), 1, what="the number of iterations")


@fixture("runs")
def runs(ref):
    rng = np.random.default_rng(42)
    for n_per, k, d, max_iterations in [(4, 2, 2, 100), (8, 3, 2, 100), (6, 4, 3, 100), (10, 3, 5, 3), (5, 5, 2, 100)]:
        X = blobs(int(rng.integers(0, 1000)), n_per, k, d)
        init = X[rng.choice(len(X), size=k, replace=False)] + rng.normal(size=(k, d)) * 0.1
        labels = rng.integers(0, k, size=len(X))
        centroids, assignments, iters = ref.kmeans(X, init, max_iterations=max_iterations)
        yield {"X": X, "init": init, "labels": labels, "max_iterations": max_iterations}, {
            "assign": ref.assign(X, init),
            "update": ref.update(X, labels, init),
            "centroids": centroids,
            "assignments": assignments,
            "iters": int(iters),
        }


@check("reference", "assignment and update match the reference", "Your two steps agree with the reference solution on random clusters.")
def reference_steps(sub):
    for case, expected in fixtures("runs"):
        label = f"X of shape {case['X'].shape} and k = {case['init'].shape[0]}"
        equal(np.asarray(sub.assign(case["X"], case["init"])).tolist(), expected["assign"].tolist(), what=f"the assignments for {label}")
        close(sub.update(case["X"], case["labels"], case["init"]), expected["update"], rtol=1e-9, what=f"the updated centroids for {label}")


@check("reference", "full runs match the reference", "Your kmeans gives the same centroids, assignments and number of iterations as the reference solution.")
def reference_runs(sub):
    for case, expected in fixtures("runs"):
        label = f"X of shape {case['X'].shape} and k = {case['init'].shape[0]}"
        centroids, assignments, iters = sub.kmeans(case["X"], case["init"], max_iterations=case["max_iterations"])
        close(centroids, expected["centroids"], rtol=1e-9, what=f"the centroids for {label}")
        equal(np.asarray(assignments).tolist(), expected["assignments"].tolist(), what=f"the assignments for {label}")
        equal(int(iters), expected["iters"], what=f"the number of iterations for {label}")
