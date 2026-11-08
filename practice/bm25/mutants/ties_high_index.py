import math
from collections import Counter

import numpy as np


def idf(corpus, term):
    n_docs = len(corpus)
    n = sum(1 for doc in corpus if term in set(doc))
    return math.log(1 + (n_docs - n + 0.5) / (n + 0.5))


def bm25_scores(corpus, query, k1=1.5, b=0.75):
    n_docs = len(corpus)
    avg_dl = sum(len(doc) for doc in corpus) / n_docs
    scores = np.zeros(n_docs)
    for i, doc in enumerate(corpus):
        dl = len(doc)
        freq = Counter(doc)
        total = 0.0
        for term in query:
            f = freq.get(term, 0)
            if f == 0:
                continue
            num = f * (k1 + 1)
            den = f + k1 * (1 - b + b * dl / avg_dl)
            total += idf(corpus, term) * num / den
        scores[i] = total
    return scores


def rank(corpus, query, top_k, k1=1.5, b=0.75):
    scores = bm25_scores(corpus, query, k1, b)
    order = sorted(range(len(corpus)), key=lambda i: (-scores[i], -i))
    return order[:top_k]
