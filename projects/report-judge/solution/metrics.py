"""Evidence score contract for stage 3; unavailable labels are explicit."""

from claims import parse_claims
from support import judge_claim


def score_report(text, evidence, expected_sources=(), facts=()):
    claims = parse_claims(text)
    verdicts = [judge_claim(c, evidence) for c in claims]
    supported = [c for c, v in zip(claims, verdicts) if v["supported"]]
    precision = len(supported) / len(claims) if claims else 0.0
    used = {cite for row in supported for cite in row["cites"]}
    expected = set(expected_sources)
    recall = len(used & expected) / len(expected) if expected else None
    covered = sum(
        any(
            all(term.casefold() in row["text"].casefold() for term in fact)
            for row in supported
        )
        for fact in facts
    )
    coverage = covered / len(facts) if facts else None
    values = [(precision, 0.5), (recall, 0.25), (coverage, 0.25)]
    available = [(v, w) for v, w in values if v is not None]
    score = (
        100 * sum(v * w for v, w in available) / sum(w for _, w in available)
        if claims
        else 0.0
    )
    return {
        "precision": precision,
        "recall": recall,
        "coverage": coverage,
        "score": round(score, 2),
        "claims": len(claims),
        "state": "no_evidence"
        if not claims
        else "needs_review"
        if len(supported) != len(claims)
        else "lexical_match",
        "unavailable": [
            name
            for name, value in [("recall", recall), ("coverage", coverage)]
            if value is None
        ],
        "verdicts": [
            {"claim": c["text"], "cites": c["cites"], **v}
            for c, v in zip(claims, verdicts)
        ],
    }
