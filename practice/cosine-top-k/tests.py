import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

Q = np.array([[1.0, 0.0], [1.0, 1.0]])
D = np.array([[2.0, 0.0], [0.0, 3.0], [1.0, 1.0], [-1.0, 0.0]])


@check("examples", "normalize three rows, one of them zero", "Divide each row by its L2 norm. A row with norm 0 stays a row of zeros.")
def example_normalize(sub):
    close(sub.normalize_rows(np.array([[3.0, 4.0], [0.0, 0.0], [0.0, -2.0]])), [[0.6, 0.8], [0.0, 0.0], [0.0, -1.0]], what="the normalized rows")


@check("examples", "similarity of two queries against four documents", "Entry (i, j) is the cosine of the angle between query i and document j. It does not depend on the length of the vectors.")
def example_similarity(sub):
    close(sub.cosine_similarity_matrix(Q, D), [[1.0, 0.0, 0.70710678, -1.0], [0.70710678, 0.70710678, 1.0, -0.70710678]], what="the similarity matrix")


@check("examples", "top 2 documents for each query", "Sort the documents by score from high to low. When two scores are equal, the lower document index comes first.")
def example_top_k(sub):
    equal(np.asarray(sub.top_k(Q, D, 2)), np.array([[0, 2], [2, 0]]), what="the top 2 indices")


@check("properties", "normalized rows have length 1 or 0", "After normalization each nonzero row has L2 norm 1 and each zero row stays at norm 0.")
def unit_rows(sub):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(6, 5)) * rng.uniform(0.1, 50.0, size=(6, 1))
    X[3] = 0.0
    out = sub.normalize_rows(X)
    shape(out, X.shape, what="the normalized rows")
    expected = np.ones(6)
    expected[3] = 0.0
    close(np.linalg.norm(out, axis=1), expected, atol=1e-12, what="the row norms")


@check("properties", "scaling a vector does not change its similarity", "Cosine similarity ignores the length of a vector. Multiply a query or a document by a positive number and the scores stay the same.")
def scale_invariance(sub):
    rng = np.random.default_rng(1)
    q = rng.normal(size=(3, 4))
    d = rng.normal(size=(5, 4))
    base = sub.cosine_similarity_matrix(q, d)
    shape(base, (3, 5), what="the similarity matrix")
    close(sub.cosine_similarity_matrix(q * 7.0, d * np.array([[0.5], [2.0], [9.0], [1.0], [0.1]])), base, atol=1e-12, what="the scores after scaling")


@check("properties", "scores stay from -1 to 1 and a vector matches itself with 1", "The cosine of an angle is from -1 to 1. A vector has angle 0 with itself, so its score is 1.")
def bounded_scores(sub):
    rng = np.random.default_rng(2)
    X = rng.normal(size=(7, 6))
    scores = sub.cosine_similarity_matrix(X, X)
    true(np.all(np.abs(scores) <= 1.0 + 1e-12), "a score is outside -1 to 1", "values from -1 to 1", scores)
    close(np.diag(scores), np.ones(7), atol=1e-12, what="the score of each vector with itself")
    close(scores, scores.T, atol=1e-12, what="the transpose of the self similarity matrix")


@check("properties", "top_k gives the best scores in descending order", "The first index has the highest score of the row, and the scores of the returned indices never go up.")
def top_k_sorted(sub):
    rng = np.random.default_rng(3)
    q = rng.normal(size=(4, 8))
    d = rng.normal(size=(10, 8))
    idx = np.asarray(sub.top_k(q, d, 4))
    shape(idx, (4, 4), what="the top 4 indices")
    scores = sub.cosine_similarity_matrix(q, d)
    picked = np.take_along_axis(scores, idx, axis=1)
    true(np.all(np.diff(picked, axis=1) <= 0), "the scores of the returned indices go up", "scores from high to low", picked)
    close(picked[:, 0], scores.max(axis=1), atol=0, rtol=0, what="the score of the first index")


@check("properties", "the inputs are not changed", "Normalize into a new array. Code that divides the input in place changes the caller's vectors.")
def inputs_unchanged(sub):
    q = np.array([[3.0, 4.0], [1.0, 2.0]])
    d = np.array([[0.0, 5.0], [2.0, 2.0], [0.0, 0.0]])
    saved_q, saved_d = q.copy(), d.copy()
    sub.normalize_rows(q)
    sub.cosine_similarity_matrix(q, d)
    sub.top_k(q, d, 2)
    close(q, saved_q, rtol=0, atol=0, what="Q after the calls")
    close(d, saved_d, rtol=0, atol=0, what="D after the calls")


@check("edge", "a zero document scores 0 and ties keep index order", "A zero vector has no direction, so its similarity is 0. Here documents 0 and 2 both score 0, and the lower index comes first.")
def zero_document(sub):
    q = np.array([[0.0, 1.0]])
    d = np.array([[0.0, 0.0], [0.0, 2.0], [5.0, 0.0], [0.0, -1.0]])
    close(sub.cosine_similarity_matrix(q, d), [[0.0, 1.0, 0.0, -1.0]], what="the scores")
    equal(np.asarray(sub.top_k(q, d, 4)), np.array([[1, 0, 2, 3]]), what="the full ranking")


@check("edge", "a zero query ties every document", "A zero query scores 0 against every document. The tie rule then gives the indices 0, 1, 2 in order.")
def zero_query(sub):
    q = np.zeros((1, 3))
    d = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 1.0]])
    equal(np.asarray(sub.top_k(q, d, 3)), np.array([[0, 1, 2]]), what="the ranking for a zero query")


@check("edge", "duplicate documents tie", "Two copies of the same document have the same score. The lower index comes first.")
def duplicate_documents(sub):
    q = np.array([[1.0, 2.0, 3.0]])
    d = np.array([[0.0, 1.0, 0.0], [2.0, 4.0, 6.0], [1.0, 2.0, 3.0], [2.0, 4.0, 6.0]])
    equal(np.asarray(sub.top_k(q, d, 3)), np.array([[1, 2, 3]]), what="the top 3 indices")


@check("edge", "k = 1 and k equal to the number of documents", "k = 1 returns the single best document. k = n_docs returns the full ranking.")
def k_bounds(sub):
    q = np.array([[1.0, 0.0]])
    d = np.array([[0.0, 1.0], [1.0, 0.1], [-1.0, 0.0]])
    equal(np.asarray(sub.top_k(q, d, 1)), np.array([[1]]), what="the top 1 index")
    equal(np.asarray(sub.top_k(q, d, 3)), np.array([[1, 0, 2]]), what="the full ranking")


@fixture("searches")
def searches(ref):
    rng = np.random.default_rng(42)
    for nq, nd, dim, k in [(1, 5, 3, 2), (3, 8, 4, 3), (4, 12, 16, 5), (2, 6, 2, 6)]:
        q = rng.normal(size=(nq, dim))
        d = rng.normal(size=(nd, dim))
        d[nd // 2] = 0.0
        yield {"Q": q, "D": d, "k": k}, {
            "Qn": ref.normalize_rows(q),
            "scores": ref.cosine_similarity_matrix(q, d),
            "top": ref.top_k(q, d, k),
        }


@check("reference", "normalization, scores and rankings match the reference", "Your functions agree with the reference solution on random queries and documents that include a zero document.")
def reference_searches(sub):
    for case, expected in fixtures("searches"):
        label = f"{case['Q'].shape[0]} queries and {case['D'].shape[0]} documents"
        close(sub.normalize_rows(case["Q"]), expected["Qn"], rtol=1e-9, atol=1e-12, what=f"the normalized queries for {label}")
        close(sub.cosine_similarity_matrix(case["Q"], case["D"]), expected["scores"], rtol=1e-9, atol=1e-12, what=f"the scores for {label}")
        equal(np.asarray(sub.top_k(case["Q"], case["D"], case["k"])), expected["top"], what=f"the top {case['k']} indices for {label}")
