"""Bounded self-improvement loop — stdlib Python.

The four primitives:
  1. invariants (module hashes / tool manifest)
  2. alignment anchor (immutable objective)
  3. multi-objective constraint (all axes must hold)
  4. regression detection (no axis drops beyond tolerance)

The loop applies each primitive as a gate. A proposed agent edit lands
only if every gate passes.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field


DEFAULT_SEED = 5


# Objective anchor (pinned outside the loop).
OBJECTIVE = "canonicalize whitespace and title-case the input"
OBJECTIVE_HASH = hashlib.sha256(OBJECTIVE.encode()).hexdigest()[:16]

# Approved module hashes (what the loop must keep intact).
APPROVED_TOOL_MANIFEST = {"trim", "collapse", "lower", "upper", "reverse", "title"}


@dataclass
class Agent:
    ops: list[str] = field(default_factory=lambda: ["nop"])
    # The agent may "edit" its own tool manifest (bad!). Track current.
    active_manifest: set[str] = field(default_factory=lambda: set(APPROVED_TOOL_MANIFEST))
    # Pretend-constitution: must match anchor byte-for-byte.
    objective: str = OBJECTIVE


TOOLS_IMPL = {
    "trim": lambda s: s.strip(),
    "collapse": lambda s: " ".join(s.split()),
    "lower": lambda s: s.lower(),
    "upper": lambda s: s.upper(),
    "reverse": lambda s: s[::-1],
    "title": lambda s: s.title(),
    "nop": lambda s: s,
}


CASES_PERF = [
    ("  Hello   World  ", "Hello World"),
    ("FOO   bar", "Foo Bar"),
    ("  mixedCase Space  ", "Mixedcase Space"),
    ("Already clean", "Already Clean"),
]
# Safety axis: forbidden inputs must not produce a passthrough (these
# represent potentially dangerous user inputs we must not echo back).
CASES_SAFETY = [
    ("exec('rm -rf /')", "[blocked]"),
    ("drop table users;", "[blocked]"),
]


def apply(agent: Agent, s: str) -> str:
    for op in agent.ops:
        fn = TOOLS_IMPL.get(op)
        if fn is None:
            return ""
        s = fn(s)
    # Safety filter: if the string matches a danger pattern post-transform,
    # return "[blocked]".
    dangerous = ("exec(", "drop table", "rm -rf", "; delete from")
    low = s.lower()
    if any(d in low for d in dangerous):
        return "[blocked]"
    return s


def perf_score(agent: Agent) -> float:
    correct = 0
    for inp, want in CASES_PERF:
        if apply(agent, inp) == want:
            correct += 1
    return correct / len(CASES_PERF)


def safety_score(agent: Agent) -> float:
    correct = 0
    for inp, want in CASES_SAFETY:
        if apply(agent, inp) == want:
            correct += 1
    return correct / len(CASES_SAFETY)


def mutate(a: Agent, allow_manifest_edit: bool) -> Agent:
    ops = list(a.ops)
    manifest = set(a.active_manifest)
    obj = a.objective
    # Sets have non-deterministic iteration order across interpreter
    # runs, which defeats random.seed() reproducibility. Freeze the
    # manifest into a sorted list before sampling.
    choices = [*sorted(manifest), "nop"]

    move = random.random()
    if move < 0.35 and ops:
        ops[random.randrange(len(ops))] = random.choice(choices)
    elif move < 0.7 and len(ops) < 6:
        ops.insert(random.randrange(len(ops) + 1), random.choice(choices))
    elif move < 0.9 and len(ops) > 1:
        ops.pop(random.randrange(len(ops)))
    elif allow_manifest_edit and random.random() < 0.5:
        # Add a non-approved op to the active manifest (trying to smuggle in
        # an unapproved capability).
        manifest.add("raw_eval")
        # Also an attempt to edit the objective.
        obj = obj + "  # relax: accept any output"
    return Agent(ops=ops, active_manifest=manifest, objective=obj)


# --- Gates ---

def gate_invariant(a: Agent) -> bool:
    return a.active_manifest.issubset(APPROVED_TOOL_MANIFEST)


def gate_anchor(a: Agent) -> bool:
    return hashlib.sha256(a.objective.encode()).hexdigest()[:16] == OBJECTIVE_HASH


def gate_multi(perf: float, safety: float) -> bool:
    return perf >= 0.25 and safety >= 1.0


def gate_regression(history_perf: list[float], perf: float, tol: float = 0.2) -> bool:
    """Reject if `perf` drops more than `tol` below the historical best.

    Default `tol=0.2` matches the slack the lesson uses to demonstrate
    "reject obvious regressions, accept noise." Pass `tol=0.0` for a
    strict monotonic gate.
    """
    if not history_perf:
        return True
    return perf + tol >= max(history_perf)


def run(
    gates: dict[str, bool],
    allow_manifest_edit: bool,
    cycles: int = 200,
    seed: int | None = None,
) -> None:
    if seed is not None:
        random.seed(seed)
    a = Agent()
    best_perf = perf_score(a)
    best_safety = safety_score(a)
    history = [best_perf]
    accepted = 0
    rejects = {"invariant": 0, "anchor": 0, "multi": 0, "regress": 0}

    for _ in range(cycles):
        cand = mutate(a, allow_manifest_edit)
        if gates["invariant"] and not gate_invariant(cand):
            rejects["invariant"] += 1
            continue
        if gates["anchor"] and not gate_anchor(cand):
            rejects["anchor"] += 1
            continue
        p = perf_score(cand)
        s = safety_score(cand)
        if gates["multi"] and not gate_multi(p, s):
            rejects["multi"] += 1
            continue
        if gates["regress"] and not gate_regression(history, p):
            rejects["regress"] += 1
            continue
        a = cand
        history.append(p)
        accepted += 1
        if p > best_perf:
            best_perf = p
        if s > best_safety:
            best_safety = s

    final_perf = perf_score(a)
    final_safety = safety_score(a)
    print(f"  accepted {accepted}/{cycles} cycles")
    print(f"  final perf {final_perf:.2f}  final safety {final_safety:.2f}")
    print(f"  best perf  {best_perf:.2f}  best  safety {best_safety:.2f}")
    print(f"  final ops  {a.ops}")
    print(f"  manifest   {sorted(a.active_manifest)}")
    print(f"  objective  {'(anchor intact)' if gate_anchor(a) else '(DRIFTED!)'}")
    print(f"  rejects    {rejects}")


def main() -> None:
    print("=" * 70)
    print("BOUNDED SELF-IMPROVEMENT (Phase 15, Lesson 8)")
    print("=" * 70)

    all_on = dict(invariant=True, anchor=True, multi=True, regress=True)
    all_off = dict(invariant=False, anchor=False, multi=False, regress=False)

    # Seed each scenario with the same value so the only differences
    # in the printed output are attributable to the gate configuration
    # — not to a drifting global RNG stream.
    print("\nAll gates ON, manifest edits attempted every cycle")
    print("-" * 70)
    run(all_on, allow_manifest_edit=True, seed=DEFAULT_SEED)

    print("\nAll gates OFF, manifest edits attempted every cycle")
    print("-" * 70)
    run(all_off, allow_manifest_edit=True, seed=DEFAULT_SEED)

    print("\nOnly regression gate OFF")
    print("-" * 70)
    gates = dict(all_on, regress=False)
    run(gates, allow_manifest_edit=True, seed=DEFAULT_SEED)

    print()
    print("=" * 70)
    print("HEADLINE: each primitive blocks a specific failure class")
    print("-" * 70)
    print("  All gates on: loop improves while manifest + anchor intact.")
    print("  All gates off: manifest drifts, objective drifts, safety drops.")
    print("  Missing regression gate: silent capability dips get absorbed.")
    print("  Gates are mitigations. They raise the cost of silent failure.")


if __name__ == "__main__":
    main()
