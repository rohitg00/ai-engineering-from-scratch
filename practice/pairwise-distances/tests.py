import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

A_EX = np.array([[0.0, 0.0], [3.0, 4.0]])
B_EX = np.array([[3.0, 0.0], [0.0, 4.0], [3.0, 4.0]])


def brute_distances(A, B):
    out = np.zeros((A.shape[0], B.shape[0]))
    for i in range(A.shape[0]):
        for j in range(B.shape[0]):
            out[i, j] = np.sqrt(np.sum((A[i] - B[j]) ** 2))
    return out


@check("examples", "squared distances of the small example", "Entry (i, j) is the squared Euclidean distance between row i of A and row j of B.")
def example_sq(sub):
    close(sub.pairwise_sq_distances(A_EX, B_EX), [[9.0, 16.0, 25.0], [16.0, 9.0, 0.0]], what="the squared distances")


@check("examples", "distances of the small example", "The distance is the square root of the squared distance.")
def example_dist(sub):
    close(sub.pairwise_distances(A_EX, B_EX), [[3.0, 4.0, 5.0], [4.0, 3.0, 0.0]], what="the distances")


@check("examples", "cosine similarities of the small example", "A pair with a zero vector has similarity 0. The other pairs are the dot product divided by the two norms.")
def example_cos(sub):
    close(sub.cosine_similarity_matrix(A_EX, B_EX), [[0.0, 0.0, 0.0], [0.6, 0.8, 1.0]], what="the cosine similarities")


@check("properties", "distances match a loop over all pairs", "The vectorized result must equal the distance that you get from one pair at a time.")
def matches_loop(sub):
    rng = np.random.default_rng(0)
    A = rng.normal(size=(5, 3))
    B = rng.normal(size=(7, 3))
    result = sub.pairwise_distances(A, B)
    shape(result, (5, 7), what="the distance matrix")
    close(result, brute_distances(A, B), rtol=1e-7, atol=1e-9, what="the distances")


@check("properties", "the distance matrix of A with itself is symmetric", "The distance from a to b is the same as the distance from b to a, and each point has distance 0 to itself.")
def symmetric(sub):
    rng = np.random.default_rng(1)
    A = rng.normal(size=(6, 4))
    D = sub.pairwise_distances(A, A)
    close(D, D.T, atol=1e-9, what="the matrix minus its transpose")
    close(np.diag(D), np.zeros(6), atol=1e-6, what="the diagonal")


@check("properties", "distances obey the triangle inequality", "For any three points, d(a, c) is at most d(a, b) + d(b, c).")
def triangle(sub):
    rng = np.random.default_rng(2)
    A = rng.normal(size=(8, 3))
    D = sub.pairwise_distances(A, A)
    excess = D[:, None, :] - (D[:, :, None] + D[None, :, :])
    true(np.all(excess <= 1e-9), "a distance is larger than the path through a third point", "d(a, c) <= d(a, b) + d(b, c)", float(np.max(excess)))


@check("properties", "cosine similarity ignores the length of the vectors", "Cosine similarity depends only on direction. Positive scaling of a row does not change it.")
def cosine_scale(sub):
    rng = np.random.default_rng(3)
    A = rng.normal(size=(4, 5))
    B = rng.normal(size=(3, 5))
    base = sub.cosine_similarity_matrix(A, B)
    close(sub.cosine_similarity_matrix(A * 7.0, B * 0.25), base, atol=1e-9, what="the similarities after scaling")
    true(np.all(np.abs(base) <= 1 + 1e-12), "a cosine similarity is outside [-1, 1]", "values from -1 to 1", base)


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    A = np.array([[1.0, 2.0], [0.0, 0.0]])
    B = np.array([[-1.0, 0.5], [2.0, 2.0], [0.0, 3.0]])
    saved_a, saved_b = A.copy(), B.copy()
    sub.pairwise_sq_distances(A, B)
    sub.pairwise_distances(A, B)
    sub.cosine_similarity_matrix(A, B)
    close(A, saved_a, rtol=0, atol=0, what="A after the calls")
    close(B, saved_b, rtol=0, atol=0, what="B after the calls")


@check("edge", "no NaN for points far from the origin", "Rounding can make the expansion slightly negative when two points are equal. Clip the squared distance at 0 before the square root.")
def far_points(sub):
    rng = np.random.default_rng(4)
    for scale in [1e2, 1e3, 1e4]:
        X = rng.normal(size=(6, 5)) * scale + scale * 10
        sq = sub.pairwise_sq_distances(X, X)
        true(np.all(sq >= 0), "a squared distance is negative", "values of 0 or more", sq)
        D = sub.pairwise_distances(X, X)
        true(np.all(np.isfinite(D)), "a distance is NaN", "finite distances", D)


@check("edge", "zero vectors give cosine similarity 0", "The norm of a zero vector is 0. Return 0 for every pair that has a zero vector, not NaN.")
def zero_rows(sub):
    A = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
    B = np.array([[0.0, 0.0, 0.0], [2.0, 0.0, 0.0], [0.0, -1.0, 0.0]])
    close(sub.cosine_similarity_matrix(A, B), [[0.0, 0.0, 0.0], [0.0, 1.0, 0.0]], what="the similarities")


@check("edge", "one row in each input", "The functions must work when A and B each have one row. The result has shape (1, 1).")
def single_rows(sub):
    A = np.array([[1.0, -2.0, 2.0]])
    B = np.array([[1.0, -2.0, 2.0]])
    close(sub.pairwise_distances(A, B), [[0.0]], atol=1e-9, what="the distance")
    close(sub.cosine_similarity_matrix(A, -B), [[-1.0]], what="the similarity with the opposite vector")


@fixture("pairs")
def pairs(ref):
    rng = np.random.default_rng(42)
    for n, m, d, scale in [(1, 4, 2, 1.0), (5, 3, 4, 2.0), (6, 6, 6, 1.0), (10, 7, 3, 5.0), (4, 9, 8, 0.5)]:
        A = rng.normal(size=(n, d)) * scale
        B = rng.normal(size=(m, d)) * scale
        if n > 2:
            A[1] = 0.0
        yield {"A": A, "B": B}, {
            "sq": ref.pairwise_sq_distances(A, B),
            "dist": ref.pairwise_distances(A, B),
            "cos": ref.cosine_similarity_matrix(A, B),
        }


@check("reference", "distances match the reference on random inputs", "Your squared distances and distances agree with the reference solution on inputs of many shapes.")
def reference_dist(sub):
    for case, expected in fixtures("pairs"):
        label = f"A of shape {case['A'].shape} and B of shape {case['B'].shape}"
        close(sub.pairwise_sq_distances(case["A"], case["B"]), expected["sq"], rtol=1e-7, atol=1e-9, what=f"the squared distances for {label}")
        close(sub.pairwise_distances(case["A"], case["B"]), expected["dist"], rtol=1e-7, atol=1e-7, what=f"the distances for {label}")


@check("reference", "cosine similarities match the reference", "Your cosine matrix agrees with the reference solution on the same inputs, including rows of zeros.")
def reference_cos(sub):
    for case, expected in fixtures("pairs"):
        label = f"A of shape {case['A'].shape} and B of shape {case['B'].shape}"
        close(sub.cosine_similarity_matrix(case["A"], case["B"]), expected["cos"], rtol=1e-7, atol=1e-9, what=f"the similarities for {label}")
