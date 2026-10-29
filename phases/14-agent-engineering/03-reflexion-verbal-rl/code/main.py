"""Toy Reflexion loop — Actor, Evaluator, Self-Reflector, Episodic memory.

Lesson: phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md
Task: pick three integers from 1..9 that sum to a target. The Actor is
scripted to start with a bad strategy and adapt when reflections are present.
Source: Shinn et al., "Reflexion: Language Agents with Verbal RL" (NeurIPS 2023).
"""

from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, field

TARGET = 20


@dataclass
class Reflection:
    trial: int
    text: str
    attempt: list[int]


@dataclass
class EpisodicMemory:
    items: list[Reflection] = field(default_factory=list)
    max_len: int = 6
    ttl: int | None = None

    def add(self, r: Reflection) -> None:
        self.items.append(r)
        if len(self.items) > self.max_len:
            self.items.pop(0)

    def as_prompt(self) -> str:
        if not self.items:
            return "(no prior reflections)"
        lines = [f"- trial {r.trial}: {r.text}" for r in self.items]
        return "\n".join(lines)

    def expire(self, current_trial: int) -> None:
        if self.ttl is None:
            return
        self.items = [r for r in self.items if current_trial - r.trial < self.ttl]


class Actor:

    def act(self, memory: EpisodicMemory) -> list[int]:
        if not memory.items:
            return [1, 2, 3]

        last = memory.items[-1]
        prev = last.attempt
        short = re.search(r"(\d+) short", last.text)
        over = re.search(r"overshoots by (\d+)", last.text)
        stuck = re.search(r"stuck", last.text)
        if short:
            return adjust(prev, +int(short.group(1)))
        if over:
            return adjust(prev, -int(over.group(1)))
        if stuck:
            return step_other(prev)
        return step_one(prev)


def adjust(prev: list[int], delta: int) -> list[int]:
    out = list(prev)
    step = 1 if delta > 0 else -1
    remaining = abs(delta)
    i = 0
    while remaining and any(x + step in range(1, 10) for x in out):
        j = i % len(out)
        if 1 <= out[j] + step <= 9:
            out[j] += step
            remaining -= 1
        i += 1
    return out


def step_one(prev: list[int]) -> list[int]:
    return [min(9, prev[0] + 1)] + prev[1:]


def step_other(prev: list[int]) -> list[int]:
    for i in range(1, len(prev)):
        if prev[i] < 9:
            return prev[:i] + [prev[i] + 1] + prev[i+1:]
    return prev


def binary_evaluator(attempt: list[int], target: int) -> bool:
    return sum(attempt) == target


def scalar_evaluator(attempt: list[int], target: int) -> int:
    return abs(sum(attempt) - target)


def heuristic_evaluator(attempt: list[int], previous_attempts: list[list[int]]) -> bool:
    return bool(previous_attempts) and attempt == previous_attempts[-1]


class SelfReflector:
    def reflect_scalar(self, attempt: list[int], delta: int) -> str:
        if delta < 0:
            return f"sum {sum(attempt)} is {-delta} short; pick larger values"
        if delta > 0:
            return f"sum {sum(attempt)} overshoots by {delta}; pick smaller values"
        return "succeeded"

    def reflect_binary(self, attempt: list[int], success: bool) -> str:
        if not success:
            return "failed, try again"
        return "succeeded"

    def reflect_heuristic(self, stuck: bool) -> str:
        return "stuck" if stuck else "new attempt"


@dataclass
class TrialResult:
    trial: int
    attempt: list[int]
    success: bool | None = None
    delta: int | None = None
    reflection: str | None = None
    live_reflections: int = 0


def run_reflexion(max_trials: int, use_memory: bool, evaluator: str,
                  ttl: int | None = None, max_len: int = 6) -> list[TrialResult]:
    actor = Actor()
    reflector = SelfReflector()
    memory = EpisodicMemory(ttl=ttl, max_len=max_len)
    trials: list[TrialResult] = []
    for t in range(1, max_trials + 1):
        if use_memory:
            memory.expire(t)
        attempt = actor.act(memory if use_memory else EpisodicMemory())
        if evaluator == "binary":
            success = binary_evaluator(attempt, TARGET)
            text = reflector.reflect_binary(attempt, success)
            trials.append(TrialResult(t, attempt, success, None, text, len(memory.items)))
            if success:
                break
            if use_memory:
                memory.add(Reflection(trial=t, text=text, attempt=attempt))
        elif evaluator == "scalar":
            delta = scalar_evaluator(attempt, TARGET)
            text = reflector.reflect_scalar(attempt, sum(attempt) - TARGET)
            success = delta == 0
            trials.append(TrialResult(t, attempt, success, delta, text, len(memory.items)))
            if success:
                break
            if use_memory:
                memory.add(Reflection(trial=t, text=text, attempt=attempt))
        elif evaluator == "heuristic":
            stuck = heuristic_evaluator(attempt, [r.attempt for r in trials])
            text = reflector.reflect_heuristic(stuck)
            success = sum(attempt) == TARGET
            trials.append(TrialResult(t, attempt, success, None, text, len(memory.items)))
            if success:
                break
            if use_memory:
                memory.add(Reflection(trial=t, text=text, attempt=attempt))
        else:
            raise ValueError(f"Unknown evaluator: {evaluator}")
    return trials


PROMPT_LEVELS = (
    "reflections first",
    "reflections last",
    "last + loud framing",
    "last + FORBIDDEN list",
)


def build_prompt(level: int, memory: EpisodicMemory) -> str:
    task = f"Pick three integers in 1..9 that sum to {TARGET}."
    if not memory.items:
        return task
    notes = memory.as_prompt()
    if level == 0:
        return f"{notes}\n{task}"
    if level == 1:
        return f"{task}\n{notes}\nAnswer:"
    if level == 2:
        return f"{task}\nPrevious attempts FAILED. Read carefully.\n{notes}\nAnswer:"
    tried = "; ".join(str(r.attempt) for r in memory.items)
    return (f"{task}\nFORBIDDEN (already tried): {tried}\n"
            f"Previous attempts FAILED. Read carefully.\n{notes}\nAnswer:")


class AdversarialActor:
    def act(self, prompt: str) -> list[int]:
        banned = re.search(r"FORBIDDEN \(already tried\): (.*)", prompt)
        if not banned:
            return [1, 2, 3]
        tried = [[int(n) for n in g.split(", ")]
                 for g in re.findall(r"\[([\d, ]+)\]", banned.group(1))]
        short = re.findall(r"(\d+) short", prompt)
        over = re.findall(r"overshoots by (\d+)", prompt)
        if short:
            guess = adjust(tried[-1], +int(short[-1]))
        elif over:
            guess = adjust(tried[-1], -int(over[-1]))
        else:
            guess = None
        if guess is not None and guess not in tried:
            return guess
        for combo in itertools.product(range(1, 10), repeat=3):
            if list(combo) not in tried:
                return list(combo)
        return tried[-1]


def run_adversarial(level: int, evaluator: str, max_trials: int = 200) -> int | None:
    actor = AdversarialActor()
    reflector = SelfReflector()
    memory = EpisodicMemory(max_len=max_trials)
    for t in range(1, max_trials + 1):
        attempt = actor.act(build_prompt(level, memory))
        gap = sum(attempt) - TARGET
        if gap == 0:
            return t
        if evaluator == "scalar":
            text = reflector.reflect_scalar(attempt, gap)
        else:
            text = reflector.reflect_binary(attempt, False)
        memory.add(Reflection(trial=t, text=text, attempt=attempt))
    return None


def summarize(trials: list[TrialResult], name: str) -> None:
    print(f"\n{name}")
    print("-" * 60)
    for r in trials:
        mark = "OK " if r.success else "..."
        d = f"{r.delta:+d}" if r.delta is not None else "n/a"
        print(f"Trial {r.trial}: {r.attempt} sum={sum(r.attempt)} delta={d} {mark} -> {r.reflection}")

    last = trials[-1]
    print(f"  final: {'success' if last.success else 'failed'} "
          f"at trial {last.trial}")


def main() -> None:
    print("=" * 70)
    print(f"REFLEXION — pick three ints in [1..9] summing to {TARGET}")
    print("Phase 14, Lesson 03")
    print("=" * 70)

    binary_trials_no_mem = run_reflexion(max_trials=12, use_memory=False, evaluator="binary")
    summarize(binary_trials_no_mem, "Binary (no episodic memory)")

    binary_trials_mem = run_reflexion(max_trials=12, use_memory=True, evaluator="binary")
    summarize(binary_trials_mem, "Binary (episodic memory on)")

    scalar_trials_mem = run_reflexion(max_trials=12, use_memory=True, evaluator="scalar")
    summarize(scalar_trials_mem, "Scalar (episodic memory on)")

    runs = [
        ("binary, no memory", binary_trials_no_mem),
        ("binary, memory", binary_trials_mem),
        ("scalar, memory", scalar_trials_mem),
    ]
    print()
    for label, trials in runs:
        outcome = "converged" if trials[-1].success else "did not converge"
        print(f"{label}: {outcome} in {len(trials)} trial(s).")
    print("Without memory, the scripted actor repeats the same attempt.")
    print("A binary signal says 'failed' but not how far off, so the actor only nudges blindly.")
    print("A scalar signal says how far and in which direction, so one reflection can be enough.")

    print("\nTTL experiment (binary evaluator, 25 trials, max_len=50)")
    print("-" * 60)
    for ttl in (None, 10, 1):
        trials = run_reflexion(max_trials=25, use_memory=True, evaluator="binary",
                               ttl=ttl, max_len=50)
        label = "no TTL" if ttl is None else f"ttl={ttl}"
        peak = max(r.live_reflections for r in trials)
        outcome = "converged" if trials[-1].success else "did not converge"
        print(f"{label}: {outcome} in {len(trials)} trial(s), "
              f"peak live reflections={peak}, final attempt={trials[-1].attempt}")
    print("The Actor reads only the newest reflection, so a TTL >= 2 changes buffer size")
    print("but not behavior; ttl=1 expires every reflection and matches the no-memory run.")

    print("\nHeuristic experiment (max 12 trials, episodic memory on)")
    print("-" * 60)
    heuristic_trials_mem = run_reflexion(max_trials=25, use_memory=True, evaluator="heuristic")
    summarize(heuristic_trials_mem, "Heuristic (episodic memory on)")

    print("\nAdversarial Actor experiment (trials to converge, cap 200)")
    print("-" * 60)
    print(f"{'prompt level':<26}{'binary note':>14}{'scalar note':>14}")
    for level, label in enumerate(PROMPT_LEVELS):
        cells = []
        for evaluator in ("binary", "scalar"):
            trials = run_adversarial(level, evaluator)
            cells.append("never" if trials is None else str(trials))
        print(f"{label:<26}{cells[0]:>14}{cells[1]:>14}")
    print("Placement and tone do not move an Actor that ignores the text.")
    print("Only a hard constraint (FORBIDDEN list) forces it to act on memory;")
    print("a scalar note then shortens the search from blind enumeration to a few trials.")

if __name__ == "__main__":
    main()
