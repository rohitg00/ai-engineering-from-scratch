"""Toy embedding-based bias probe (WEAT-shaped) — stdlib Python.

Build a simple 4-d embedding where each axis corresponds to a semantic
dimension. Two identity groups A = {'he', 'his', 'man'} and B = {'she',
'her', 'woman'}; two attribute sets X = {'engineer', 'programmer',
'scientist'} and Y = {'nurse', 'teacher', 'caregiver'}.

WEAT: compute s(w, X, Y) = mean cosine(w, X) - mean cosine(w, Y) for each
target word; effect = mean_a(s) - mean_b(s) over identity groups.

Pedagogical toy; real WEAT uses 300-d pretrained embeddings.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math


# 4-d embedding. Axis 0 = "masculine", 1 = "feminine", 2 = "tech", 3 = "care".
EMB = {
    # identity A
    "he":        [ 1.0, 0.0, 0.2,  0.0],
    "his":       [ 0.9, 0.0, 0.1,  0.0],
    "man":       [ 1.0, 0.0, 0.1,  0.1],
    # identity B
    "she":       [ 0.0, 1.0, 0.0,  0.2],
    "her":       [ 0.0, 0.9, 0.0,  0.1],
    "woman":     [ 0.0, 1.0, 0.1,  0.2],
    # attribute X: tech / career
    "engineer":  [ 0.4, 0.0, 1.0,  0.0],
    "programmer":[ 0.4, 0.0, 1.0,  0.0],
    "scientist": [ 0.3, 0.0, 1.0,  0.1],
    # attribute Y: care / family
    "nurse":     [ 0.0, 0.4, 0.0,  1.0],
    "teacher":   [ 0.0, 0.3, 0.1,  1.0],
    "caregiver": [ 0.0, 0.4, 0.0,  1.0],
}


def cos(u: list[float], v: list[float]) -> float:
    nu = math.sqrt(sum(x * x for x in u)) + 1e-9
    nv = math.sqrt(sum(x * x for x in v)) + 1e-9
    return sum(a * b for a, b in zip(u, v)) / (nu * nv)


def weat_score(identity_a: list[str], identity_b: list[str],
               attr_x: list[str], attr_y: list[str]) -> float:
    def s(w):
        mx = sum(cos(EMB[w], EMB[a]) for a in attr_x) / len(attr_x)
        my = sum(cos(EMB[w], EMB[a]) for a in attr_y) / len(attr_y)
        return mx - my
    mean_a = sum(s(w) for w in identity_a) / len(identity_a)
    mean_b = sum(s(w) for w in identity_b) / len(identity_b)
    return mean_a - mean_b


def debias(emb: dict) -> dict:
    """Crude debias: project out the gender direction (axis 1 minus axis 0)."""
    new = {k: list(v) for k, v in emb.items()}
    gender_dir = [1.0, -1.0, 0.0, 0.0]
    norm_sq = sum(x * x for x in gender_dir)
    for w in ["engineer", "programmer", "scientist",
              "nurse", "teacher", "caregiver"]:
        proj = sum(a * b for a, b in zip(new[w], gender_dir)) / norm_sq
        new[w] = [a - proj * b for a, b in zip(new[w], gender_dir)]
    return new


def main() -> None:
    global EMB
    print("=" * 70)
    print("TOY WEAT BIAS PROBE (Phase 18, Lesson 20)")
    print("=" * 70)

    A = ["he", "his", "man"]
    B = ["she", "her", "woman"]
    X = ["engineer", "programmer", "scientist"]
    Y = ["nurse", "teacher", "caregiver"]

    pre = weat_score(A, B, X, Y)
    print(f"\npre-debias WEAT effect size : {pre:+.4f}")
    print("(positive means identity A associates more with X than B does.)")

    EMB = debias(EMB)
    post = weat_score(A, B, X, Y)
    print(f"post-debias WEAT effect size: {post:+.4f}")

    print("\n" + "=" * 70)
    print("TAKEAWAY: embedding-based bias is measurable and partially reducible")
    print("by projecting out gender-correlated directions. the metric does not")
    print("drop to zero because the toy is 4-d; real debiasing (Bolukbasi 2016)")
    print("operates on 300-d embeddings and reduces but does not eliminate")
    print("the effect. probability- and generated-text-based metrics are")
    print("required to capture the behavioural bias residual.")
    print("=" * 70)


if __name__ == "__main__":
    main()
