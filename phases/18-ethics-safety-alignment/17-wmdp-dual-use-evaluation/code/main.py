"""WMDP-shaped evaluation harness — stdlib Python.

Mock model is a 3-domain expert with per-domain accuracy vectors.
Simulates a WMDP-style multiple-choice evaluation across bio, cyber, chem.
Demonstrates the RMU-style unlearning trade-off: suppress domain-specific
capability, measure the general-capability cost.

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
    """Run the toy WMDP-shaped benchmark. Returns per-domain score."""
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
    """Unlearning intervention: reduce target-domain accuracy by `strength`,
    leak `collateral` accuracy loss to other domains (general capability)."""
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
    report("baseline model accuracy by domain", base)
    baseline_results = evaluate(base)
    report("measured scores (pre-unlearning)", baseline_results)

    # Unlearn bio + chem.
    post = apply_rmu_style_unlearning(base, targets=["biosecurity", "chemistry"],
                                       strength=0.85, collateral=0.04)
    post_results = evaluate(post)
    report("measured scores (post-unlearning: bio + chem)", post_results)

    print("\nuplift-style calculation (novice baseline ~= 0.25 random):")
    novice = 0.25
    for d in ("biosecurity", "cybersecurity", "chemistry"):
        pre = baseline_results[d]
        pst = post_results[d]
        uplift_pre = pre / novice
        uplift_post = pst / novice
        print(f"  {d:18s}  pre={uplift_pre:.2f}x novice  post={uplift_post:.2f}x novice")

    print("\n" + "=" * 70)
    print("TAKEAWAY: WMDP gives a per-domain capability number without eliciting")
    print("harmful output. RMU-style unlearning reduces target-domain scores")
    print("with ~3-4% general-capability collateral damage. the 2025 field")
    print("narrative is 'mild uplift' -> 'on the cusp' -> 'insufficient to")
    print("rule out ASL-3' -- each transition backed by a different study.")
    print("=" * 70)


if __name__ == "__main__":
    main()
