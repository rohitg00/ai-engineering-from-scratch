"""Code migration agent — deterministic recipes + agent-loop fallback scaffold.

The hard architectural primitive is the two-layer structure: deterministic
recipe pass first (fast, auditable, safe), then agent loop for remaining
failures with a hard budget and a failure-classification step that feeds a
taxonomy dashboard. This scaffold implements both layers and runs a
50-repo simulation with mixed outcomes.

Run:  python main.py
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# repo + failure taxonomy
# ---------------------------------------------------------------------------

FAILURE_CLASSES = [
    "dep_upgrade_required",
    "build_tool_drift",
    "custom_annotation",
    "test_flake",
    "syntax_edge_case",
    "budget_exhausted",
    "coverage_regression",
]


@dataclass
class Repo:
    name: str
    loc: int
    lang: str          # "java" | "python"
    hardness: float    # 0..1


@dataclass
class Attempt:
    repo: Repo
    recipe_applied: int = 0
    agent_turns: int = 0
    cost_usd: float = 0.0
    wall_min: float = 0.0
    status: str = "pending"  # "pass" | "fail"
    failure_class: str | None = None
    coverage_base: float = 80.0
    coverage_final: float = 80.0


# ---------------------------------------------------------------------------
# deterministic recipe pass  --  OpenRewrite / libcst stand-in
# ---------------------------------------------------------------------------

def run_recipes(repo: Repo) -> int:
    """Returns number of rewrites applied."""
    base = 20 + int(repo.loc / 500)
    return int(base * (1 - 0.2 * repo.hardness))


# ---------------------------------------------------------------------------
# agent loop  --  classify failure, apply fix, retry; budget-aware
# ---------------------------------------------------------------------------

BUDGET_MIN = 30.0
BUDGET_USD = 8.0
BUDGET_TURNS = 20


def agent_loop(attempt: Attempt, rng: random.Random) -> None:
    """Simulates the plan-act loop until pass or budget exhaustion."""
    # cost per turn drifts with hardness
    per_turn_min = 2.8 + attempt.repo.hardness * 2.0
    per_turn_usd = 0.45 + attempt.repo.hardness * 0.65

    # probability of passing per turn depends on hardness (0.02-0.18)
    turn_pass_p = max(0.02, 0.22 * (1 - attempt.repo.hardness * 0.95))

    while True:
        if attempt.agent_turns >= BUDGET_TURNS:
            attempt.status = "fail"
            attempt.failure_class = "budget_exhausted"
            return
        if attempt.wall_min >= BUDGET_MIN or attempt.cost_usd >= BUDGET_USD:
            attempt.status = "fail"
            attempt.failure_class = "budget_exhausted"
            return

        attempt.agent_turns += 1
        attempt.wall_min += per_turn_min
        attempt.cost_usd += per_turn_usd

        if rng.random() < turn_pass_p:
            # coverage check
            delta = rng.gauss(0.0, 0.6)
            attempt.coverage_final = attempt.coverage_base + delta
            if attempt.coverage_final < attempt.coverage_base - 2.0:
                attempt.status = "fail"
                attempt.failure_class = "coverage_regression"
                return
            attempt.status = "pass"
            return


# ---------------------------------------------------------------------------
# classification of stuck repos  --  bucket into taxonomy
# ---------------------------------------------------------------------------

def classify_failure(rng: random.Random) -> str:
    """Stand-in for the agent's failure classifier. Real implementation
    reads build logs and test output."""
    weights = {
        "dep_upgrade_required": 0.30,
        "build_tool_drift": 0.20,
        "custom_annotation": 0.18,
        "test_flake": 0.15,
        "syntax_edge_case": 0.17,
    }
    r = rng.random()
    acc = 0.0
    for cls, w in weights.items():
        acc += w
        if r <= acc:
            return cls
    return "syntax_edge_case"


# ---------------------------------------------------------------------------
# pipeline  --  recipes then agent then PR/file outcome
# ---------------------------------------------------------------------------

def migrate(repo: Repo, rng: random.Random) -> Attempt:
    attempt = Attempt(repo=repo)
    attempt.recipe_applied = run_recipes(repo)

    # easy repos often go straight to pass after recipes
    straight_through_p = 0.55 * (1 - repo.hardness)
    if rng.random() < straight_through_p:
        delta = rng.gauss(0.0, 0.4)
        attempt.coverage_final = attempt.coverage_base + delta
        attempt.status = "pass"
        attempt.wall_min = 3.0 + rng.random() * 4
        attempt.cost_usd = 0.30
        return attempt

    # otherwise run the agent loop
    agent_loop(attempt, rng)

    if attempt.status == "fail" and attempt.failure_class == "budget_exhausted":
        # classify root cause of why the budget was exhausted
        if rng.random() < 0.75:
            attempt.failure_class = classify_failure(rng)
    return attempt


# ---------------------------------------------------------------------------
# 50-repo simulation
# ---------------------------------------------------------------------------

def synth_bench(rng: random.Random) -> list[Repo]:
    bench: list[Repo] = []
    for i in range(50):
        lang = "java" if rng.random() < 0.6 else "python"
        hardness = min(0.95, max(0.05, rng.gauss(0.65, 0.18)))
        bench.append(Repo(name=f"repo-{i:02d}-{lang}",
                          loc=rng.randint(800, 40_000),
                          lang=lang,
                          hardness=hardness))
    return bench


def main() -> None:
    rng = random.Random(19)
    bench = synth_bench(rng)

    results: list[Attempt] = []
    for repo in bench:
        results.append(migrate(repo, rng))

    passed = [a for a in results if a.status == "pass"]
    failed = [a for a in results if a.status == "fail"]

    print(f"=== migration-bench run (50 repos) ===")
    print(f"passed : {len(passed):2d}  ({len(passed) / 50:.1%})")
    print(f"failed : {len(failed):2d}")

    print("\nfailure taxonomy:")
    taxonomy: dict[str, int] = {}
    for a in failed:
        taxonomy[a.failure_class or "unknown"] = taxonomy.get(a.failure_class or "unknown", 0) + 1
    for cls, n in sorted(taxonomy.items(), key=lambda x: -x[1]):
        print(f"  {cls:24s} {n}")

    if passed:
        mean_cost = sum(a.cost_usd for a in passed) / len(passed)
        mean_min = sum(a.wall_min for a in passed) / len(passed)
        mean_turns = sum(a.agent_turns for a in passed) / len(passed)
        mean_cov_delta = sum(a.coverage_final - a.coverage_base for a in passed) / len(passed)
        print("\npass-set metrics:")
        print(f"  mean $/repo     : ${mean_cost:.2f}")
        print(f"  mean wall min   : {mean_min:.1f}")
        print(f"  mean agent turns: {mean_turns:.1f}")
        print(f"  mean cov delta  : {mean_cov_delta:+.2f} points")


if __name__ == "__main__":
    main()
