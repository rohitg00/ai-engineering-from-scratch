import math
import re
import unicodedata
from collections import Counter


def normalize(text, aliases=None):
    if not isinstance(text, str):
        raise ValueError("text must be a string")
    aliases = aliases or {}
    canonical = lambda value: unicodedata.normalize("NFC", value.casefold())
    if not isinstance(aliases, dict) or any(
        not isinstance(k, str) or not isinstance(v, str) for k, v in aliases.items()
    ):
        raise ValueError("aliases must map strings to strings")
    aliases = {canonical(k): canonical(v) for k, v in aliases.items()}
    return [aliases.get(word, word) for word in re.findall(r"\w+", canonical(text))]


def build_index(documents, aliases=None):
    if not isinstance(documents, dict) or any(
        (not isinstance(k, str) or not k for k in documents)
    ):
        raise ValueError("document ids must be nonempty strings")
    terms = {k: Counter(normalize(v, aliases)) for k, v in documents.items()}
    df = Counter((term for counts in terms.values() for term in counts))
    idf = {
        term: math.log((1 + len(terms)) / (1 + count)) + 1 for term, count in df.items()
    }
    vectors = {}
    for key, counts in terms.items():
        weighted = {term: count * idf[term] for term, count in counts.items()}
        norm = math.sqrt(sum((v * v for v in weighted.values())))
        vectors[key] = (
            {term: value / norm for term, value in weighted.items()} if norm else {}
        )
    return {"vectors": vectors, "idf": idf, "aliases": dict(aliases or {})}


def search(index, query, k=3):
    if not isinstance(k, int) or k < 1:
        raise ValueError("k must be positive")
    counts = Counter(normalize(query, index["aliases"]))
    values = {
        term: count * index["idf"][term]
        for term, count in counts.items()
        if term in index["idf"]
    }
    norm = math.sqrt(sum((v * v for v in values.values())))
    if not norm:
        return []
    results = []
    for key, vector in index["vectors"].items():
        score = sum(
            (value / norm * vector.get(term, 0) for term, value in values.items())
        )
        if score > 0:
            results.append(
                {
                    "id": key,
                    "score": round(score, 6),
                    "matched": sorted(set(values) & set(vector)),
                }
            )
    return sorted(results, key=lambda row: (-row["score"], row["id"]))[:k]


def evaluate(index, cases, k=3):
    if any((c["expected"] not in index["vectors"] for c in cases)):
        raise ValueError("unknown labeled document")
    hits = sum(
        (
            any((r["id"] == c["expected"] for r in search(index, c["query"], k)))
            for c in cases
        )
    )
    return {
        "hits": hits,
        "total": len(cases),
        "recall": hits / len(cases) if cases else 0.0,
    }
