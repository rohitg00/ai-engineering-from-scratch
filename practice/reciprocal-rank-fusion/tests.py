from practice_check import check, close, equal, fixture, fixtures, raises, true

import numpy as np

BM25 = [3, 1, 4]
DENSE = [1, 5, 3]


def as_pairs(result):
    return [(int(doc_id), float(score)) for doc_id, score in result]


def check_fused(actual, expected, what):
    pairs = as_pairs(actual)
    equal([doc_id for doc_id, _ in pairs], [doc_id for doc_id, _ in expected], what=f"the order of {what}")
    close([score for _, score in pairs], [score for _, score in expected], rtol=1e-12, what=f"the scores of {what}")


@check("examples", "scores of two lists with k = 60", "Each list adds 1 / (k + rank) to each document in it. The first document of a list has rank 1.")
def example_scores(sub):
    scores = sub.rrf_scores([BM25, DENSE])
    equal(sorted(scores), [1, 3, 4, 5], what="the document ids in the scores")
    close([scores[d] for d in (1, 3, 4, 5)], [0.03252247488101534, 0.032266458495966696, 0.015873015873015872, 0.016129032258064516], rtol=1e-12, what="the scores of documents 1, 3, 4 and 5")


@check("examples", "fused ranking of two lists", "fuse sorts the documents by fused score from high to low and returns (doc_id, score) pairs.")
def example_fuse(sub):
    check_fused(sub.fuse([BM25, DENSE]), [(1, 0.03252247488101534), (3, 0.032266458495966696), (5, 0.016129032258064516), (4, 0.015873015873015872)], "the fused ranking")


@check("examples", "weights scale each list", "With weights, list i adds weights[i] / (k + rank). A weight of 2 on BM25 puts document 3 first.")
def example_weights(sub):
    check_fused(sub.fuse([BM25, DENSE], weights=[2.0, 1.0]), [(3, 0.04865990111891751), (1, 0.048651507139079855), (4, 0.031746031746031744), (5, 0.016129032258064516)], "the weighted ranking")


@check("properties", "every document in any list gets a score", "RRF scores the union of all lists. A document in only one list still gets a score from that list.")
def union_of_lists(sub):
    rankings = [[0, 1, 2], [5, 6], [], [2, 9]]
    equal(sorted(sub.rrf_scores(rankings)), [0, 1, 2, 5, 6, 9], what="the scored document ids")
    equal(sorted(doc_id for doc_id, _ in as_pairs(sub.fuse(rankings))), [0, 1, 2, 5, 6, 9], what="the fused document ids")


@check("properties", "a single list keeps its order", "With one list, scores fall as the rank grows, so the fused order is the list order.")
def single_list(sub):
    ranking = [8, 2, 5, 0, 7]
    equal([doc_id for doc_id, _ in as_pairs(sub.fuse([ranking]))], ranking, what="the fused order of one list")
    close(sub.rrf_scores([ranking], k=10)[8], 1.0 / 11.0, rtol=1e-12, what="the score of the first document with k = 10")


@check("properties", "the order of the lists does not matter", "The fused score is a sum over lists, so a swap of the lists gives the same scores and the same ranking.")
def list_order(sub):
    rng = np.random.default_rng(0)
    a = [int(x) for x in rng.permutation(10)[:6]]
    b = [int(x) for x in rng.permutation(10)[:7]]
    c = [int(x) for x in rng.permutation(10)[:4]]
    one = as_pairs(sub.fuse([a, b, c]))
    two = as_pairs(sub.fuse([c, a, b]))
    equal([d for d, _ in one], [d for d, _ in two], what="the ranking after a swap of the lists")
    close([s for _, s in one], [s for _, s in two], rtol=1e-12, what="the scores after a swap of the lists")


@check("properties", "the fused scores never go up", "fuse returns the documents from the highest fused score to the lowest.")
def descending(sub):
    rng = np.random.default_rng(1)
    rankings = [[int(x) for x in rng.permutation(15)[:n]] for n in (8, 12, 5)]
    scores = [s for _, s in as_pairs(sub.fuse(rankings))]
    true(all(x >= y for x, y in zip(scores, scores[1:])), "a fused score is larger than the score before it", "scores from high to low", scores)


@check("properties", "the inputs are not changed", "RRF reads the lists. It must not sort or change them.")
def inputs_unchanged(sub):
    rankings = [[4, 2, 9], [9, 4]]
    weights = [1.0, 0.5]
    sub.rrf_scores(rankings, 60, weights)
    sub.fuse(rankings, 60, weights)
    equal(rankings, [[4, 2, 9], [9, 4]], what="the rankings after the calls")
    equal(weights, [1.0, 0.5], what="the weights after the calls")


@check("edge", "equal scores put the lower doc id first", "Documents 7 and 2 have ranks 1 and 2 in opposite lists, so their scores are equal. The lower id, 2, comes first.")
def tie_rule(sub):
    check_fused(sub.fuse([[7, 2], [2, 7]]), [(2, 0.03252247488101534), (7, 0.03252247488101534)], "the tied ranking")


@check("edge", "a small k gives more weight to the top ranks", "With k = 1, rank 1 adds 1 / 2 and rank 2 adds 1 / 3.")
def small_k(sub):
    check_fused(sub.fuse([BM25, DENSE], k=1), [(1, 0.8333333333333333), (3, 0.75), (5, 0.3333333333333333), (4, 0.25)], "the ranking with k = 1")


@check("edge", "weights of the wrong length raise ValueError", "There must be one weight for each list. A silent zip would drop a list without a message.")
def bad_weights(sub):
    raises(ValueError, sub.rrf_scores, [[1, 2], [2, 3]], 60, [1.0])
    raises(ValueError, sub.fuse, [[1, 2]], 60, [1.0, 1.0])


@check("edge", "no lists or only empty lists give no documents", "With nothing to fuse, rrf_scores returns an empty dict and fuse returns an empty list.")
def empty_inputs(sub):
    equal(dict(sub.rrf_scores([])), {}, what="the scores of no lists")
    equal(list(sub.fuse([[], []])), [], what="the fused ranking of two empty lists")


@fixture("rankings")
def rankings(ref):
    rng = np.random.default_rng(42)
    for n_lists, n_docs, k, weighted in [(2, 6, 60, False), (3, 12, 60, True), (2, 20, 10, False), (4, 9, 1, True)]:
        lists = [[int(x) for x in rng.permutation(n_docs)[: int(rng.integers(1, n_docs + 1))]] for _ in range(n_lists)]
        weights = [float(w) for w in rng.uniform(0.5, 2.0, size=n_lists)] if weighted else None
        yield {"rankings": lists, "k": k, "weights": weights}, [[d, s] for d, s in ref.fuse(lists, k, weights)]


@check("reference", "fused rankings match the reference", "Your fused order and scores agree with the reference solution on random lists of several lengths, values of k and weights.")
def reference_rankings(sub):
    for case, expected in fixtures("rankings"):
        label = f"{len(case['rankings'])} lists with k = {case['k']} and weights {case['weights']}"
        check_fused(sub.fuse(case["rankings"], case["k"], case["weights"]), [(int(d), float(s)) for d, s in expected], label)
