from collections import defaultdict


def rrf_scores(rankings, k=60, weights=None):
    if weights is None:
        weights = [1.0] * len(rankings)
    if len(weights) != len(rankings):
        raise ValueError("weights length must match rankings length")
    score = defaultdict(float)
    for w, ranks in zip(weights, rankings):
        for rank, doc_id in enumerate(ranks):
            score[doc_id] += w * (1.0 / (k + rank))
    return dict(score)


def fuse(rankings, k=60, weights=None):
    score = rrf_scores(rankings, k, weights)
    return sorted(score.items(), key=lambda item: (-item[1], item[0]))
