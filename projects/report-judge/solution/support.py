"""Check evidence before averaging scores.

Lesson: projects/report-judge/stages/02-support/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def support(claim, source):
    tokens = lambda s: (
        set(re.findall(r"\b\w+\b", s.lower())) - {"a", "an", "the", "is", "of", "and"}
    )
    c, s = tokens(claim), tokens(source)
    if not c:
        return {"score": 0.0, "reason": "empty"}
    if (c & {"no", "not", "never", "cannot"}) != (s & {"no", "not", "never", "cannot"}):
        return {"score": 0.0, "reason": "negation"}
    if set(re.findall(r"\d+(?:\.\d+)?", claim)) - set(
        re.findall(r"\d+(?:\.\d+)?", source)
    ):
        return {"score": 0.0, "reason": "number"}
    stop = {"a", "an", "the", "is", "of", "and"}
    claim_order = [w for w in re.findall(r"\b\w+\b", claim.casefold()) if w not in stop]
    source_order = [
        w for w in re.findall(r"\b\w+\b", source.casefold()) if w not in stop
    ]
    if c <= s:
        remaining = iter(source_order)
        if not all(
            any(word == candidate for candidate in remaining) for word in claim_order
        ):
            return {"score": 0.0, "reason": "order_requires_review"}
    return {"score": len(c & s) / len(c), "reason": "lexical_overlap"}


def judge_claim(claim, evidence, threshold=0.8):
    if not 0 <= threshold <= 1:
        raise ValueError("threshold must be between zero and one")
    if not claim["cites"]:
        return {"supported": False, "reason": "uncited", "score": 0.0}
    if any(c not in evidence for c in claim["cites"]):
        return {"supported": False, "reason": "dangling", "score": 0.0}
    best = max(
        (support(claim["text"], evidence[c]) for c in claim["cites"]),
        key=lambda r: r["score"],
    )
    return {**best, "supported": best["score"] >= threshold}
