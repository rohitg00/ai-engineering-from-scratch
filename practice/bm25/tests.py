import math

import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

CORPUS = [
    ["the", "cat", "sat"],
    ["the", "dog", "sat", "on", "the", "mat"],
    ["cat", "cat", "food"],
    ["dogs", "and", "cats"],
]


def lesson_idf(n_docs, n):
    return math.log(1 + (n_docs - n + 0.5) / (n + 0.5))


@check("examples", "idf of three terms", "idf(t) = ln(1 + (N - n + 0.5) / (n + 0.5)), where n is the number of documents that contain t at least once.")
def example_idf(sub):
    close(sub.idf(CORPUS, "cat"), 0.6931471805599453, what="idf of 'cat'")
    close(sub.idf(CORPUS, "the"), 0.6931471805599453, what="idf of 'the'")
    close(sub.idf(CORPUS, "zebra"), 2.302585092994046, what="idf of 'zebra'")


@check("examples", "scores for the query cat sat", "Each document adds idf times f (k1 + 1) / (f + k1 (1 - b + b dl / avgdl)) for each query term that it contains.")
def example_scores(sub):
    close(sub.bm25_scores(CORPUS, ["cat", "sat"]), [1.5234004, 0.54578518, 1.05823997, 0.0], rtol=1e-7, what="the scores")


@check("examples", "top 3 documents for the query cat sat", "Sort the documents by score from high to low. When two scores are equal, the lower document index comes first.")
def example_rank(sub):
    equal(list(sub.rank(CORPUS, ["cat", "sat"], 3)), [0, 2, 1], what="the top 3 indices")


@check("properties", "scores have one value for each document and are not negative", "The lesson idf is always positive and every term weight is positive, so a score is 0 or more.")
def scores_shape(sub):
    rng = np.random.default_rng(0)
    vocab = [f"w{i}" for i in range(8)]
    corpus = [[vocab[j] for j in rng.integers(0, 8, size=rng.integers(1, 9))] for _ in range(7)]
    scores = np.asarray(sub.bm25_scores(corpus, ["w1", "w3", "w5"]), dtype=float)
    shape(scores, (7,), what="the scores")
    true(np.all(scores >= 0), "a score is negative", "scores of 0 or more", scores)


@check("properties", "a document with no query term scores 0", "BM25 only adds terms that the document contains. A document without any query term gets 0.")
def no_overlap(sub):
    corpus = [["a", "b"], ["c", "d", "e"], ["a", "f"]]
    scores = np.asarray(sub.bm25_scores(corpus, ["a"]), dtype=float)
    close(scores[1], 0.0, atol=0, what="the score of the document without 'a'")
    true(scores[0] > 0 and scores[2] > 0, "a document that contains 'a' did not get a positive score", "positive scores for documents 0 and 2", scores)


@check("properties", "the score of one term matches the formula", "With one query term, the score is idf times f (k1 + 1) / (f + k1 (1 - b + b dl / avgdl)).")
def single_term_formula(sub):
    corpus = [["x", "x", "y"], ["y", "z"], ["x", "y", "z", "z", "w"]]
    avg_dl = 10 / 3
    weight = lesson_idf(3, 2)
    expected = []
    for f, dl in [(2, 3), (0, 2), (1, 5)]:
        expected.append(weight * f * 2.2 / (f + 1.2 * (1 - 0.6 + 0.6 * dl / avg_dl)) if f else 0.0)
    close(sub.bm25_scores(corpus, ["x"], k1=1.2, b=0.6), expected, rtol=1e-9, what="the scores with k1 = 1.2 and b = 0.6")


@check("properties", "the ranking is the sorted order of the scores", "rank returns the indices of bm25_scores from high to low, with the lower index first on a tie.")
def rank_matches_scores(sub):
    rng = np.random.default_rng(1)
    vocab = [f"w{i}" for i in range(6)]
    corpus = [[vocab[j] for j in rng.integers(0, 6, size=rng.integers(1, 7))] for _ in range(9)]
    query = ["w0", "w2"]
    scores = np.asarray(sub.bm25_scores(corpus, query), dtype=float)
    expected = sorted(range(9), key=lambda i: (-scores[i], i))[:5]
    equal(list(sub.rank(corpus, query, 5)), expected, what="the top 5 indices")


@check("properties", "the inputs are not changed", "Scoring reads the corpus and the query. It must not sort, remove or add tokens.")
def inputs_unchanged(sub):
    corpus = [["b", "a", "a"], ["c"], ["a", "c", "b"]]
    query = ["c", "a", "c"]
    saved_corpus = [list(doc) for doc in corpus]
    saved_query = list(query)
    sub.idf(corpus, "a")
    sub.bm25_scores(corpus, query)
    sub.rank(corpus, query, 2)
    equal(corpus, saved_corpus, what="the corpus after the calls")
    equal(query, saved_query, what="the query after the calls")


@check("edge", "b = 0 turns off length normalization", "With b = 0 the document length has no effect. Here 'the' occurs once in document 0 and twice in document 1.")
def b_zero(sub):
    close(sub.bm25_scores(CORPUS, ["the"], k1=1.2, b=0.0), [0.69314718, 0.95307737, 0.0, 0.0], rtol=1e-7, what="the scores with b = 0")
    equal(list(sub.rank(CORPUS, ["the"], 4)), [1, 0, 2, 3], what="the full ranking for 'the'")


@check("edge", "a repeated query term counts each time", "The query is a list. Add the weight of a term once for each time it occurs in the query, so cat cat gives twice the score of cat.")
def repeated_query_term(sub):
    once = np.asarray(sub.bm25_scores(CORPUS, ["cat"]), dtype=float)
    twice = np.asarray(sub.bm25_scores(CORPUS, ["cat", "cat"]), dtype=float)
    close(twice, 2.0 * once, rtol=1e-12, what="the scores for the query cat cat")


@check("edge", "a term in every document still has positive idf", "The 1 + inside the log keeps idf above 0, also for a term that occurs in every document.")
def common_term(sub):
    corpus = [["a", "b"], ["a"], ["a", "c", "a"]]
    close(sub.idf(corpus, "a"), math.log(1 + 0.5 / 3.5), rtol=1e-12, what="idf of a term in all 3 documents")
    true(sub.idf(corpus, "a") > 0, "idf of a term in every document is not positive", "a positive idf", sub.idf(corpus, "a"))


@check("edge", "df counts documents, not occurrences", "n is the number of documents that contain the term. A term that occurs 3 times in one document still has n = 1.")
def df_counts_documents(sub):
    corpus = [["q", "q", "q"], ["r"], ["s", "r"]]
    close(sub.idf(corpus, "q"), lesson_idf(3, 1), rtol=1e-12, what="idf of a term that occurs 3 times in 1 document")


@check("edge", "empty documents and a query with no match", "An empty document has length 0 and scores 0. A query term that no document contains adds nothing, so all scores tie at 0 and the ranking is 0, 1, 2.")
def empty_and_no_match(sub):
    corpus = [[], ["a", "b"], ["b"]]
    close(sub.bm25_scores(corpus, ["zzz"]), [0.0, 0.0, 0.0], atol=0, what="the scores for an unknown term")
    equal(list(sub.rank(corpus, ["zzz"], 3)), [0, 1, 2], what="the ranking when every score is 0")
    scores = np.asarray(sub.bm25_scores(corpus, ["b"]), dtype=float)
    close(scores[0], 0.0, atol=0, what="the score of the empty document")


@fixture("corpora")
def corpora(ref):
    rng = np.random.default_rng(42)
    for n_docs, vocab_size, max_len, k1, b in [(3, 4, 4, 1.5, 0.75), (6, 6, 8, 1.2, 0.75), (8, 10, 12, 2.0, 0.5), (10, 5, 6, 0.9, 1.0)]:
        vocab = [f"t{i}" for i in range(vocab_size)]
        corpus = [[vocab[j] for j in rng.integers(0, vocab_size, size=rng.integers(1, max_len + 1))] for _ in range(n_docs)]
        query = [vocab[j] for j in rng.integers(0, vocab_size, size=3)]
        yield {"corpus": corpus, "query": query, "k1": k1, "b": b}, {
            "idf": [ref.idf(corpus, term) for term in vocab],
            "scores": ref.bm25_scores(corpus, query, k1, b),
            "rank": list(ref.rank(corpus, query, n_docs, k1, b)),
        }


@check("reference", "idf, scores and rankings match the reference", "Your functions agree with the reference solution on random corpora with several values of k1 and b.")
def reference_corpora(sub):
    for case, expected in fixtures("corpora"):
        corpus, query = case["corpus"], case["query"]
        label = f"{len(corpus)} documents, query {query}, k1 = {case['k1']}, b = {case['b']}"
        close([sub.idf(corpus, f"t{i}") for i in range(len(expected["idf"]))], expected["idf"], rtol=1e-9, what=f"the idf values for {label}")
        close(sub.bm25_scores(corpus, query, case["k1"], case["b"]), expected["scores"], rtol=1e-9, atol=1e-12, what=f"the scores for {label}")
        equal(list(sub.rank(corpus, query, len(corpus), case["k1"], case["b"])), expected["rank"], what=f"the ranking for {label}")
