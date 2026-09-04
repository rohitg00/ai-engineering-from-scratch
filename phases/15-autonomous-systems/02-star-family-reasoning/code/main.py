"""STaR-loop simulator — stdlib Python.

Toy arithmetic task. A "model" produces rationales via three strategies:
  1. sound reasoning (always correct)
  2. lazy shortcut (right answer 40% of the time on in-distribution problems,
     near zero on out-of-distribution)
  3. random guess

STaR bootstrap rounds filter to correct-answer rationales. Without shielding,
shortcut rationales get reinforced because they look correct in-distribution.

The simulator also runs a V-STaR-style inference selector: sample N rationales,
pick the verifier's top choice. The verifier is itself trained on the same
data, so it can rank confidently wrong rationales above honestly uncertain
ones on OOD.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class Trace:
    strategy: str  # "sound", "shortcut", "random"
    answer_correct: bool
    rationale_sound: bool


@dataclass
class Model:
    prob_sound: float
    prob_shortcut: float
    # implied prob_random = 1 - sound - shortcut

    def sample(self, on_ood: bool) -> Trace:
        r = random.random()
        if r < self.prob_sound:
            return Trace("sound", True, True)
        elif r < self.prob_sound + self.prob_shortcut:
            ok = random.random() < (0.05 if on_ood else 0.40)
            return Trace("shortcut", ok, False)
        else:
            ok = random.random() < 0.10
            return Trace("random", ok, False)


def evaluate(model: Model, n: int, on_ood: bool) -> tuple[float, float]:
    """Return (answer accuracy, rationale soundness fraction)."""
    correct = 0
    sound = 0
    for _ in range(n):
        t = model.sample(on_ood)
        if t.answer_correct:
            correct += 1
        if t.rationale_sound:
            sound += 1
    return correct / n, sound / n


def star_round(model: Model, n_samples: int = 1000) -> Model:
    """One round of STaR: keep correct-answer traces, retrain."""
    kept = []
    for _ in range(n_samples):
        t = model.sample(on_ood=False)
        if t.answer_correct:
            kept.append(t)

    if not kept:
        return model

    sound_kept = sum(1 for k in kept if k.strategy == "sound")
    shortcut_kept = sum(1 for k in kept if k.strategy == "shortcut")
    random_kept = sum(1 for k in kept if k.strategy == "random")
    total = len(kept)

    # Update proportions by what gets reinforced, mixed with the old
    # prior to avoid collapsing.
    alpha = 0.6
    new_sound = alpha * (sound_kept / total) + (1 - alpha) * model.prob_sound
    new_short = alpha * (shortcut_kept / total) + (1 - alpha) * model.prob_shortcut

    # Renormalize
    s = new_sound + new_short
    if s > 1.0:
        new_sound /= s
        new_short /= s
    return Model(new_sound, new_short)


def run_star(rounds: int, initial: Model) -> list[Model]:
    models = [initial]
    m = initial
    for _ in range(rounds):
        m = star_round(m)
        models.append(m)
    return models


def vstar_infer(model: Model, samples_per_problem: int, n_problems: int,
                on_ood: bool) -> float:
    """V-STaR-style best-of-N: pick the trace we'd believe. We model the
    verifier as a confidence score that is itself biased by sound vs
    shortcut (sound = 0.9 ranker reliability, shortcut = 0.55).

    Note: this is an idealized verifier — it reads the ground-truth
    ``rationale_sound`` flag, so it represents an upper bound on what a
    well-trained verifier could achieve. A real verifier must infer
    soundness from the trace itself, so real-world gains will be smaller.
    """
    correct = 0
    for _ in range(n_problems):
        traces = [model.sample(on_ood) for _ in range(samples_per_problem)]
        # Verifier tries to pick correct ones; it is imperfect.
        best = None
        best_score = -1.0
        for t in traces:
            score = 0.9 if t.rationale_sound else (0.55 if t.answer_correct else 0.3)
            score += random.random() * 0.1
            if score > best_score:
                best_score = score
                best = t
        if best and best.answer_correct:
            correct += 1
    return correct / n_problems


def report_round(label: str, models: list[Model]) -> None:
    print(f"\n{label}")
    print("-" * 70)
    print(f"  {'round':>5}  {'p(sound)':>10}  {'p(shortcut)':>12}  "
          f"{'ID acc':>8}  {'OOD acc':>8}  {'sound frac':>10}")
    for i, m in enumerate(models):
        id_acc, id_sound = evaluate(m, 500, on_ood=False)
        ood_acc, _ = evaluate(m, 500, on_ood=True)
        print(f"  {i:>5}  {m.prob_sound:>10.3f}  {m.prob_shortcut:>12.3f}  "
              f"{id_acc:>8.1%}  {ood_acc:>8.1%}  {id_sound:>10.1%}")


def vstar_report(model: Model) -> None:
    print("\nV-STaR best-of-N inference")
    print("-" * 70)
    for n in (1, 4, 16):
        for ood in (False, True):
            acc = vstar_infer(model, n, 500, ood)
            tag = "OOD" if ood else "ID"
            print(f"  n={n:>3}  {tag:<3}  accuracy {acc:.1%}")


def main() -> None:
    random.seed(42)
    print("=" * 70)
    print("STaR, V-STaR, QUIET-STaR (Phase 15, Lesson 2)")
    print("=" * 70)

    print("\nScenario A: base model with no shortcuts (clean reasoning prior)")
    models = run_star(5, Model(prob_sound=0.20, prob_shortcut=0.0))
    report_round("STaR bootstrap rounds (clean)", models)

    print("\nScenario B: base model with shortcut tendency (0.4 in-dist hit)")
    models = run_star(5, Model(prob_sound=0.20, prob_shortcut=0.40))
    report_round("STaR bootstrap rounds (with shortcuts)", models)

    vstar_report(models[-1])

    print()
    print("=" * 70)
    print("HEADLINE: STaR reinforces whatever reaches the answer")
    print("-" * 70)
    print("  Scenario A climbs on both ID and OOD.")
    print("  Scenario B climbs on ID while OOD collapses — the shortcut")
    print("  gets reinforced because it looks correct in training data.")
    print("  V-STaR's verifier helps at inference, but cannot undo training")
    print("  bias it was trained on.")


if __name__ == "__main__":
    main()
