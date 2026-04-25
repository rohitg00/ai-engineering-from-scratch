"""HTN planner (with scripted LLM fallback) plus a toy evolutionary search.

Two demos, one file. HTN shows the ChatHTN pattern: symbolic planner falls back
to an LLM for decomposition when no method matches. Evolutionary search shows
the AlphaEvolve pattern: ensemble mutations filtered by a deterministic evaluator.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Operator:
    name: str
    preconditions: tuple[str, ...]
    effects_add: tuple[str, ...]
    effects_remove: tuple[str, ...] = ()

    def applicable(self, state: set[str]) -> bool:
        return all(p in state for p in self.preconditions)

    def apply(self, state: set[str]) -> set[str]:
        new_state = set(state)
        for fact in self.effects_remove:
            new_state.discard(fact)
        for fact in self.effects_add:
            new_state.add(fact)
        return new_state


@dataclass
class Method:
    name: str
    task: str
    preconditions: tuple[str, ...]
    subtasks: tuple[str, ...]

    def applicable(self, state: set[str]) -> bool:
        return all(p in state for p in self.preconditions)


class ScriptedLLM:
    """Stands in for ChatHTN's LLM fallback. Returns scripted decompositions."""

    def __init__(self, scripts: dict[str, tuple[str, ...]]) -> None:
        self._scripts = scripts
        self.calls: list[str] = []

    def decompose(self, task: str, state: set[str]) -> tuple[str, ...] | None:
        self.calls.append(task)
        return self._scripts.get(task)


@dataclass
class HTNPlanner:
    operators: dict[str, Operator]
    methods: dict[str, list[Method]]
    llm: ScriptedLLM
    cached_methods: dict[str, tuple[str, ...]] = field(default_factory=dict)

    def plan(self, task: str, state: set[str],
             depth: int = 0, max_depth: int = 12) -> list[str] | None:
        if depth > max_depth:
            return None
        if task in self.operators:
            op = self.operators[task]
            if op.applicable(state):
                return [task]
            return None
        applicable = [m for m in self.methods.get(task, []) if m.applicable(state)]
        if not applicable and task in self.cached_methods:
            subtasks = self.cached_methods[task]
            return self._expand(list(subtasks), state, depth)
        if not applicable:
            suggested = self.llm.decompose(task, state)
            if suggested is None:
                return None
            if not all(s in self.operators or s in self.methods for s in suggested):
                return None
            self.cached_methods[task] = suggested
            return self._expand(list(suggested), state, depth)
        method = applicable[0]
        return self._expand(list(method.subtasks), state, depth)

    def _expand(self, subtasks: list[str], state: set[str], depth: int) -> list[str] | None:
        plan: list[str] = []
        current_state = set(state)
        for subtask in subtasks:
            sub_plan = self.plan(subtask, current_state, depth=depth + 1)
            if sub_plan is None:
                return None
            for step in sub_plan:
                op = self.operators.get(step)
                if op is None or not op.applicable(current_state):
                    return None
                current_state = op.apply(current_state)
                plan.append(step)
        return plan


def htn_demo() -> None:
    print("-" * 70)
    print("demo 1: ChatHTN-style hybrid HTN planner")
    print("-" * 70)
    operators = {
        "open_editor": Operator("open_editor", ("logged_in",), ("editor_open",)),
        "write_tests": Operator("write_tests", ("editor_open",), ("tests_written",)),
        "run_tests": Operator("run_tests", ("tests_written",), ("tests_passing",)),
        "open_pr": Operator("open_pr", ("tests_passing",), ("pr_open",)),
    }
    methods: dict[str, list[Method]] = {
        "ship_change": [
            Method("ship_change_m1", "ship_change", ("logged_in",),
                   ("open_editor", "write_tests", "run_tests", "open_pr")),
        ],
    }
    llm = ScriptedLLM({
        "ship_feature_with_migration": (
            "open_editor", "write_tests", "run_tests", "open_pr",
        ),
    })
    planner = HTNPlanner(operators=operators, methods=methods, llm=llm)

    state = {"logged_in"}
    print(f"\ncase A: goal=ship_change (method library matches)")
    plan = planner.plan("ship_change", state)
    print(f"  plan: {plan}")
    print(f"  llm calls: {planner.llm.calls}")

    print(f"\ncase B: goal=ship_feature_with_migration (no method -> LLM fallback)")
    plan = planner.plan("ship_feature_with_migration", state)
    print(f"  plan: {plan}")
    print(f"  llm calls (cumulative): {planner.llm.calls}")
    print(f"  cache hit for next time: {planner.cached_methods}")

    print(f"\ncase C: goal=ship_feature_with_migration (cached now -> no LLM call)")
    llm_calls_before = len(planner.llm.calls)
    plan = planner.plan("ship_feature_with_migration", state)
    print(f"  plan: {plan}")
    new_calls = len(planner.llm.calls) - llm_calls_before
    print(f"  new LLM calls this round: {new_calls}  (expect 0)")


def evolutionary_demo() -> None:
    print()
    print("-" * 70)
    print("demo 2: AlphaEvolve-style evolutionary search (toy)")
    print("-" * 70)
    random.seed(0)

    def evaluator(a: int, b: int) -> float:
        total = 0.0
        for x in range(-5, 6):
            target = 3 * x + 7
            guess = a * x + b
            total += (target - guess) ** 2
        return total

    def random_mutation(a: int, b: int) -> tuple[int, int]:
        da = random.choice((-2, -1, 0, 1, 2))
        db = random.choice((-2, -1, 0, 1, 2))
        return a + da, b + db

    population: list[tuple[int, int, float]] = [
        (random.randint(-10, 10), random.randint(-10, 10), 0.0)
        for _ in range(6)
    ]
    population = [(a, b, evaluator(a, b)) for (a, b, _) in population]
    population.sort(key=lambda x: x[2])

    generations = 12
    print(f"\nseed population (a*x + b, target 3x + 7)")
    for a, b, fit in population[:3]:
        print(f"  a={a:3d}  b={b:3d}  fitness={fit:.2f}")

    for gen in range(1, generations + 1):
        survivors = population[:3]
        children: list[tuple[int, int, float]] = []
        for a, b, _ in survivors:
            for _ in range(3):
                na, nb = random_mutation(a, b)
                children.append((na, nb, evaluator(na, nb)))
        population = sorted(survivors + children, key=lambda x: x[2])[:6]
        if gen % 3 == 0:
            best = population[0]
            print(f"  gen {gen:02d}: best a={best[0]:3d} b={best[1]:3d} "
                  f"fitness={best[2]:.2f}")

    best = population[0]
    print(f"\nconverged on: a={best[0]}  b={best[1]}  fitness={best[2]:.2f}")
    print(f"expected:     a=3    b=7    fitness=0.00")


def main() -> None:
    print("=" * 70)
    print("HTN + EVOLUTIONARY SEARCH — Phase 14, Lesson 11")
    print("=" * 70)
    htn_demo()
    evolutionary_demo()
    print()
    print("HTN: LLM amplifies method library; symbolic layer owns correctness.")
    print("AlphaEvolve: ensemble mutates, deterministic evaluator selects.")
    print("both require machine-checkable structure. reach for ReAct first.")


if __name__ == "__main__":
    main()
