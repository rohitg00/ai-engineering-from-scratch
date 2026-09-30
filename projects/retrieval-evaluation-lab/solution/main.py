import math


def validate(ranking, judgments, k):
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise ValueError("positive integer cutoff required")
    if any((not isinstance(x, str) or not x for x in ranking)) or len(
        set(ranking)
    ) != len(ranking):
        raise ValueError("unique document ids required")
    if any(
        (
            not isinstance(v, int) or isinstance(v, bool) or (not 0 <= v <= 3)
            for v in judgments.values()
        )
    ):
        raise ValueError("integer relevance grades 0..3 required")
    return True


def precision_recall(ranking, judgments, k):
    validate(ranking, judgments, k)
    relevant = {key for key, value in judgments.items() if value > 0}
    hits = len(set(ranking[:k]) & relevant)
    return {"precision": hits / k, "recall": hits / len(relevant) if relevant else 0.0}


def rank_metrics(ranking, judgments, k):
    validate(ranking, judgments, k)
    rr = next(
        (1 / (i + 1) for i, key in enumerate(ranking[:k]) if judgments.get(key, 0) > 0),
        0.0,
    )
    dcg = sum(
        (
            (2 ** judgments.get(key, 0) - 1) / math.log2(i + 2)
            for i, key in enumerate(ranking[:k])
        )
    )
    ideal = sum(
        (
            (2**grade - 1) / math.log2(i + 2)
            for i, grade in enumerate(sorted(judgments.values(), reverse=True)[:k])
        )
    )
    return {"rr": rr, "ndcg": dcg / ideal if ideal else 0.0}


def compare_systems(systems, judgments, k):
    result = {}
    for name, queries in systems.items():
        if set(queries) != set(judgments):
            raise ValueError("systems must cover identical judged queries")
        rows = {
            q: {
                **precision_recall(queries[q], j, k),
                **rank_metrics(queries[q], j, k),
                "unjudged": sum((doc not in j for doc in queries[q][:k])),
            }
            for q, j in judgments.items()
        }
        means = {
            metric: sum((row[metric] for row in rows.values())) / len(rows)
            if rows
            else 0
            for metric in ("precision", "recall", "rr", "ndcg")
        }
        result[name] = {"queries": rows, "mean": means}
    return result
