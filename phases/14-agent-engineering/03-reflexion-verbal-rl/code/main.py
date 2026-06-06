"""Toy Reflexion loop — Actor, Evaluator, Self-Reflector, Episodic memory.

Task: pick three integers from 1..9 that sum to a target. The Actor is
scripted to start with a bad strategy and adapt when reflections are present.
"""

from __future__ import annotations

from dataclasses import dataclass, field


TARGET = 20


@dataclass
class Reflection:
    trial: int
    text: str


@dataclass
class EpisodicMemory:
    items: list[Reflection] = field(default_factory=list)
    max_len: int = 6

    def add(self, r: Reflection) -> None:
        self.items.append(r)
        if len(self.items) > self.max_len:
            self.items.pop(0)

    def as_prompt(self) -> str:
        if not self.items:
            return "(no prior reflections)"
        lines = [f"- trial {r.trial}: {r.text}" for r in self.items]
        return "\n".join(lines)


class Actor:
    """Scripted policy. Without reflections it stays on bad choices; with
    at least one reflection it moves toward the target sum."""

    def act(self, memory: EpisodicMemory) -> list[int]:
        n = len(memory.items)
        if n == 0:
            return [1, 2, 3]
        if n == 1:
            return [5, 6, 7]
        if n == 2:
            return [6, 7, 7]
        return [6, 7, 7]


def binary_evaluator(attempt: list[int], target: int) -> tuple[bool, int]:
    total = sum(attempt)
    return total == target, total - target


class SelfReflector:
    def reflect(self, attempt: list[int], delta: int) -> str:
        if delta < 0:
            return f"sum {sum(attempt)} is {-delta} short; pick larger values"
        if delta > 0:
            return f"sum {sum(attempt)} overshoots by {delta}; pick smaller values"
        return "succeeded"


@dataclass
class TrialResult:
    trial: int
    attempt: list[int]
    success: bool
    delta: int
    reflection: str


def run_reflexion(max_trials: int, use_memory: bool) -> list[TrialResult]:
    actor = Actor()
    reflector = SelfReflector()
    memory = EpisodicMemory()
    trials: list[TrialResult] = []
    for t in range(1, max_trials + 1):
        attempt = actor.act(memory if use_memory else EpisodicMemory())
        success, delta = binary_evaluator(attempt, TARGET)
        text = reflector.reflect(attempt, delta)
        trials.append(TrialResult(t, attempt, success, delta, text))
        if success:
            break
        memory.add(Reflection(trial=t, text=text))
    return trials


def summarize(trials: list[TrialResult], name: str) -> None:
    print(f"\n{name}")
    print("-" * 60)
    for r in trials:
        mark = "OK " if r.success else "..."
        print(f"  trial {r.trial}: {r.attempt} sum={sum(r.attempt)} "
              f"delta={r.delta:+d} {mark} -> {r.reflection}")
    last = trials[-1]
    print(f"  final: {'success' if last.success else 'failed'} "
          f"at trial {last.trial}")


def main() -> None:
    print("=" * 70)
    print(f"REFLEXION — pick three ints in [1..9] summing to {TARGET}")
    print("Phase 14, Lesson 03")
    print("=" * 70)

    trials_no_mem = run_reflexion(max_trials=4, use_memory=False)
    summarize(trials_no_mem, "BASELINE (no episodic memory)")

    trials_mem = run_reflexion(max_trials=4, use_memory=True)
    summarize(trials_mem, "REFLEXION (episodic memory on)")

    baseline_steps = len(trials_no_mem)
    reflex_steps = len(trials_mem)
    print()
    print(f"baseline used {baseline_steps} trials; reflexion used {reflex_steps}.")
    print("Without a reflection in the prompt, the scripted actor never adapts.")
    print("With one reflection, the actor corrects; with two, it converges.")


if __name__ == "__main__":
    main()
