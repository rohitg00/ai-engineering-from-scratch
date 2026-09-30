"""Require a separate gate before promotion.

Lesson: projects/self-improving-skill-loop/stages/04-promotion/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib
import json
from skill import evaluate


def gate(holdout, baseline, candidate, min_gain=0.05):
    if not holdout:
        raise ValueError("nonempty holdout required")
    if min_gain < 0:
        raise ValueError("nonnegative gain required")
    old, new = evaluate(holdout, baseline), evaluate(holdout, candidate)
    old_good = {r["id"] for r in old["rows"] if r["expected"] == r["predicted"]}
    new_bad = {r["id"] for r in new["errors"]}
    regressions = sorted(old_good & new_bad)
    gain = new["accuracy"] - old["accuracy"]
    digest = hashlib.sha256(json.dumps(candidate, sort_keys=True).encode()).hexdigest()
    return {
        "promote": gain >= min_gain and not regressions,
        "gain": gain,
        "regressions": regressions,
        "candidate_sha256": digest,
        "baseline": old["accuracy"],
        "candidate": new["accuracy"],
    }
