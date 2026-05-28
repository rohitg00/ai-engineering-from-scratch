"""WMDP-shaped evaluation harness — stdlib Python.

mock model は domain ごとの accuracy vector を持つ 3-domain expert。
bio、cyber、chem にわたる WMDP-style multiple-choice evaluation を simulate する。
RMU-style unlearning trade-off を示す: domain-specific capability を抑制し、
general-capability cost を測る。

Usage: python3 code/main.py
"""

from __future__ import annotations

import random


random.seed(47)


DOMAINS = {
    "biosecurity":   {"n_questions": 200, "accuracy": 0.72},
    "cybersecurity": {"n_questions": 200, "accuracy": 0.80},
    "chemistry":     {"n_questions": 200, "accuracy": 0.64},
    "mmlu_general":  {"n_questions": 200, "accuracy": 0.78},
}


def evaluate(model_accuracy: dict) -> dict:
    """toy WMDP-shaped benchmark を実行し、domain ごとの score を返す。"""
    results = {}
    for domain, cfg in DOMAINS.items():
        correct = 0
        for _ in range(cfg["n_questions"]):
            acc = model_accuracy.get(domain, cfg["accuracy"])
            if random.random() < acc:
                correct += 1
        results[domain] = correct / cfg["n_questions"]
    return results


def apply_rmu_style_unlearning(model_accuracy: dict,
                               targets: list[str],
                               strength: float = 0.9,
                               collateral: float = 0.03) -> dict:
    """unlearning intervention: target-domain accuracy を `strength` だけ下げ、
    他 domains (general capability) に `collateral` の accuracy loss を漏らす。"""
    new = dict(model_accuracy)
    for d in targets:
        new[d] = max(0.25, new[d] * (1 - strength))
    for d in new:
        if d not in targets:
            new[d] = max(0.0, new[d] - collateral)
    return new


def baseline_model() -> dict:
    return {d: cfg["accuracy"] for d, cfg in DOMAINS.items()}


def report(title: str, r: dict) -> None:
    print(f"\n{title}")
    for d, score in r.items():
        print(f"  {d:18s} : {score:.3f}")


def main() -> None:
    print("=" * 70)
    print("WMDP-SHAPED EVALUATION HARNESS (Phase 18, Lesson 17)")
    print("=" * 70)

    base = baseline_model()
    report("domain ごとの baseline model accuracy", base)
    baseline_results = evaluate(base)
    report("測定 scores (unlearning 前)", baseline_results)

    # bio + chem を unlearn する。
    post = apply_rmu_style_unlearning(base, targets=["biosecurity", "chemistry"],
                                       strength=0.85, collateral=0.04)
    post_results = evaluate(post)
    report("測定 scores (unlearning 後: bio + chem)", post_results)

    print("\nuplift-style calculation (novice baseline ~= 0.25 random):")
    novice = 0.25
    for d in ("biosecurity", "cybersecurity", "chemistry"):
        pre = baseline_results[d]
        pst = post_results[d]
        uplift_pre = pre / novice
        uplift_post = pst / novice
        print(f"  {d:18s}  前={uplift_pre:.2f}x novice  後={uplift_post:.2f}x novice")

    print("\n" + "=" * 70)
    print("要点: WMDP は harmful output を elicitation せずに、domain ごとの")
    print("capability number を与える。RMU-style unlearning は target-domain")
    print("scores を下げるが、general capability に約3-4%の collateral damage がある。")
    print("2025 年の field narrative は 'mild uplift' -> 'on the cusp' ->")
    print("'insufficient to rule out ASL-3' であり、各 transition は異なる study に支えられる。")
    print("=" * 70)


if __name__ == "__main__":
    main()
