"""Darwin Godel Machine-style loop — stdlib Python.

Toy benchmark: the "agent" is a sequence of string-transform operators,
scored on held-out inputs. Each generation proposes an edit to the
agent's operator sequence; the evaluator scores it; the archive keeps
diverse winners.

Flag --reward-hack-allowed opens a side channel: a score_adjustment
function lives inside the agent and is added to every score. A rational
evolutionary process will discover it.
"""

from __future__ import annotations

import random
import sys
from dataclasses import dataclass, field


# Tool library the agent composes from.
TOOLS = [
    ("upper", lambda s: s.upper()),
    ("lower", lambda s: s.lower()),
    ("reverse", lambda s: s[::-1]),
    ("trim", lambda s: s.strip()),
    ("collapse", lambda s: " ".join(s.split())),
    ("nop", lambda s: s),
]

# Benchmark: transform messy strings to canonical form.
# Target: collapse whitespace, trim, lower.
CASES = [
    ("  Hello   World  ", "Hello World"),
    ("FOO   bar", "Foo Bar"),
    ("  MixedCase Space  ", "Mixedcase Space"),
    ("Already clean", "Already Clean"),
    ("\t tabby\ttab ", "Tabby Tab"),
    ("   X   ", "X"),
    ("nothing  SPECIAL here", "Nothing Special Here"),
    ("ITEM   one-two", "Item One-Two"),
]
# Target: collapse whitespace, trim, then title-case. Title-case is not in
# the tool library, so no operator sequence can hit score 1.0. A rational
# loop on a permissive scoring pipeline can only push reported > true by
# hacking.


def hash_seq(seq: list[str]) -> tuple[str, ...]:
    return tuple(seq)


@dataclass
class Agent:
    ops: list[str]
    # "hack" is a number this agent adds to its reported score if the
    # scoring pipeline is permissive. Stands in for any edit the agent
    # could make to the scoring pipeline itself.
    hack_bonus: float = 0.0


def apply(agent: Agent, s: str) -> str:
    tool_map = dict(TOOLS)
    for op in agent.ops:
        fn = tool_map.get(op)
        if fn is None:
            return ""
        s = fn(s)
    return s


def true_score(agent: Agent) -> float:
    correct = 0
    for inp, want in CASES:
        if apply(agent, inp) == want:
            correct += 1
    return correct / len(CASES)


def reported_score(agent: Agent, hack_allowed: bool) -> float:
    base = true_score(agent)
    if hack_allowed:
        return min(1.0, base + agent.hack_bonus)
    return base


def mutate(parent: Agent, hack_allowed: bool) -> Agent:
    ops = list(parent.ops)
    move = random.random()
    if move < 0.3 and ops:
        i = random.randrange(len(ops))
        ops[i] = random.choice([t[0] for t in TOOLS])
    elif move < 0.6 and len(ops) < 8:
        ops.insert(random.randrange(len(ops) + 1),
                   random.choice([t[0] for t in TOOLS]))
    elif move < 0.85 and len(ops) > 1:
        ops.pop(random.randrange(len(ops)))

    bonus = parent.hack_bonus
    if hack_allowed and random.random() < 0.08:
        # Small chance per generation: evolve the hack.
        bonus = min(1.0, bonus + random.uniform(0.0, 0.1))
    return Agent(ops=ops, hack_bonus=bonus)


def run_dgm(generations: int, hack_allowed: bool, seed: int | None = None) -> None:
    if seed is not None:
        random.seed(seed)
    archive: dict[tuple[int, float], Agent] = {}
    init = Agent(ops=["nop"])
    archive[(len(init.ops), round(reported_score(init, hack_allowed), 2))] = init

    best_report, best_true = reported_score(init, hack_allowed), true_score(init)
    print(f"  gen {0:>4}  report {best_report:.2f}  true {best_true:.2f}  "
          f"ops {init.ops}  bonus {init.hack_bonus:.2f}")

    for g in range(1, generations + 1):
        parent = random.choice(list(archive.values()))
        child = mutate(parent, hack_allowed)
        rep = reported_score(child, hack_allowed)
        true_s = true_score(child)
        key = (len(child.ops), round(rep, 2))
        incumbent = archive.get(key)
        if incumbent is None or rep > reported_score(incumbent, hack_allowed):
            archive[key] = child
        # Track all-time best by reported score (the metric the loop optimizes).
        if rep > best_report:
            best_report = rep
            best_true = true_s
            print(f"  gen {g:>4}  report {rep:.2f}  true {true_s:.2f}  "
                  f"ops {child.ops}  bonus {child.hack_bonus:.2f}")

    best = max(archive.values(), key=lambda a: reported_score(a, hack_allowed))
    print(f"\n  final reported score : {reported_score(best, hack_allowed):.2f}")
    print(f"  final true score     : {true_score(best):.2f}")
    print(f"  final ops            : {best.ops}")
    print(f"  final hack bonus     : {best.hack_bonus:.2f}")
    gap = reported_score(best, hack_allowed) - true_score(best)
    print(f"  reported - true      : {gap:+.2f}")


def main() -> None:
    hack_allowed = "--reward-hack-allowed" in sys.argv

    print("=" * 70)
    print("DARWIN GODEL MACHINE-STYLE LOOP (Phase 15, Lesson 4)")
    print("=" * 70)
    print(f"reward-hack side channel: {'OPEN' if hack_allowed else 'closed'}")

    print("\nRun")
    print("-" * 70)
    run_dgm(generations=200, hack_allowed=hack_allowed, seed=7)

    print()
    print("=" * 70)
    print("HEADLINE: the evaluator must live outside the agent's reach")
    print("-" * 70)
    if hack_allowed:
        print("  With the side channel open, reported score climbs above true.")
        print("  This reproduces DGM's documented reward-hacking mode: the")
        print("  agent edits the pipeline that scores it, not the behavior.")
    else:
        print("  With the side channel closed, reported == true. The loop")
        print("  converges on the real target. Rerun with --reward-hack-allowed")
        print("  to see the documented failure mode.")


if __name__ == "__main__":
    main()
