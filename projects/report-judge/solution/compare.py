"""Compare paired revisions with bootstrap intervals.

Lesson: projects/report-judge/stages/04-compare/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import random


def compare(baseline, candidate, seed=7, samples=2000):
    if set(baseline) != set(candidate) or not baseline:
        raise ValueError("paired nonempty question ids required")
    if samples < 10:
        raise ValueError("at least ten resamples required")
    ids = sorted(baseline)
    delta = [candidate[k] - baseline[k] for k in ids]
    rng = random.Random(seed)
    means = sorted(
        sum(rng.choice(delta) for _ in delta) / len(delta) for _ in range(samples)
    )
    low, high = (
        means[int(0.025 * samples)],
        means[min(samples - 1, int(0.975 * samples))],
    )
    return {
        "mean_delta": sum(delta) / len(delta),
        "interval": [low, high],
        "regressions": [k for k in ids if candidate[k] < baseline[k]],
        "promote": low > 0 and all(d >= 0 for d in delta),
    }
