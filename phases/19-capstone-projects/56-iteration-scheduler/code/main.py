"""Auto-research orchestrator: hypothesis queue, parallel slots, UCB scoring, fan-out.

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 19 lesson 54 (paper writer; receives paper.trigger fan-out)
- Phase 19 lesson 55 (critic loop; consumes results downstream)
- Phase 19 lessons 50-53 (earlier auto-research stages)

Stdlib + numpy only. Run: python3 code/main.py
"""

from __future__ import annotations

import asyncio
import json
import math
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

import numpy as np


@dataclass
class Hypothesis:
    id: str
    branch: str
    payload: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {"id": self.id, "branch": self.branch, "payload": dict(self.payload)}


@dataclass
class Result:
    hypothesis_id: str
    branch: str
    reward: float
    payload: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "hypothesis_id": self.hypothesis_id,
            "branch": self.branch,
            "reward": self.reward,
            "payload": dict(self.payload),
        }


@dataclass
class BranchStats:
    branch: str
    runs: int = 0
    reward_sum: float = 0.0
    pruned: bool = False
    paper_triggered: bool = False

    @property
    def mean(self) -> float:
        return (self.reward_sum / self.runs) if self.runs else 0.0

    def to_dict(self) -> dict:
        return {
            "branch": self.branch,
            "runs": self.runs,
            "reward_sum": self.reward_sum,
            "mean": self.mean,
            "pruned": self.pruned,
            "paper_triggered": self.paper_triggered,
        }


@dataclass
class TraceEvent:
    kind: str
    payload: dict

    def to_dict(self) -> dict:
        return {"kind": self.kind, "payload": dict(self.payload)}


@dataclass
class SchedulerReport:
    stop_reason: str
    experiments_run: int
    wall_seconds: float
    branches: list[BranchStats]
    paper_triggers: list[str]
    trace: list[TraceEvent]

    def to_dict(self) -> dict:
        return {
            "stop_reason": self.stop_reason,
            "experiments_run": self.experiments_run,
            "wall_seconds": round(self.wall_seconds, 4),
            "branches": [b.to_dict() for b in self.branches],
            "paper_triggers": list(self.paper_triggers),
            "trace": [e.to_dict() for e in self.trace],
        }


Runner = Callable[[Hypothesis], Awaitable[Result]]
Expander = Callable[[Result], list[Hypothesis]]


def ucb_score(branch_stats: BranchStats, total_runs: int, c: float) -> float:
    if branch_stats.runs == 0:
        return float("inf")
    if total_runs == 0:
        return branch_stats.mean
    return branch_stats.mean + c * math.sqrt(math.log(max(total_runs, 1)) / branch_stats.runs)


class IterationScheduler:
    """Drives a hypothesis queue across N parallel asyncio slots with UCB picking."""

    def __init__(
        self,
        runner: Runner,
        slots: int = 3,
        max_experiments: int = 50,
        max_seconds: float = 30.0,
        exploration_c: float = math.sqrt(2.0),
        paper_threshold: float = 0.7,
        prune_floor: float = 0.2,
        prune_after_runs: int = 3,
        expander: Expander | None = None,
    ) -> None:
        if slots < 1:
            raise ValueError("slots must be >= 1")
        if max_experiments < 1:
            raise ValueError("max_experiments must be >= 1")
        self.runner = runner
        self.slots = slots
        self.max_experiments = max_experiments
        self.max_seconds = max_seconds
        self.exploration_c = exploration_c
        self.paper_threshold = paper_threshold
        self.prune_floor = prune_floor
        self.prune_after_runs = prune_after_runs
        self.expander = expander

    def _pick_next(self, queue: list[Hypothesis], stats: dict[str, BranchStats]) -> int | None:
        best_idx: int | None = None
        best_score = -float("inf")
        total_runs = sum(s.runs for s in stats.values())
        for idx, hyp in enumerate(queue):
            bs = stats.get(hyp.branch)
            if bs is not None and bs.pruned:
                continue
            score = ucb_score(bs or BranchStats(branch=hyp.branch),
                              total_runs, self.exploration_c)
            if score > best_score:
                best_score = score
                best_idx = idx
        return best_idx

    async def run(self, seed: list[Hypothesis]) -> SchedulerReport:
        queue: list[Hypothesis] = list(seed)
        stats: dict[str, BranchStats] = {h.branch: BranchStats(branch=h.branch) for h in seed}
        in_flight: dict[asyncio.Task[Result], Hypothesis] = {}
        trace: list[TraceEvent] = []
        triggers: list[str] = []
        experiments_run = 0
        stop_reason = "queue_empty"
        t0 = time.monotonic()

        def deadline_hit() -> bool:
            return (time.monotonic() - t0) >= self.max_seconds

        def budget_hit() -> bool:
            return experiments_run >= self.max_experiments

        def dispatch_until_full() -> None:
            nonlocal experiments_run
            while queue and len(in_flight) < self.slots and not budget_hit() and not deadline_hit():
                idx = self._pick_next(queue, stats)
                if idx is None:
                    return
                hyp = queue.pop(idx)
                if hyp.branch not in stats:
                    stats[hyp.branch] = BranchStats(branch=hyp.branch)
                task = asyncio.create_task(self.runner(hyp))
                in_flight[task] = hyp
                experiments_run += 1
                trace.append(TraceEvent(
                    kind="dispatch",
                    payload={"hypothesis_id": hyp.id, "branch": hyp.branch,
                             "slot_count": len(in_flight)},
                ))

        dispatch_until_full()

        while in_flight:
            done, _pending = await asyncio.wait(
                in_flight.keys(), return_when=asyncio.FIRST_COMPLETED,
            )
            for task in done:
                hyp = in_flight.pop(task)
                try:
                    result = task.result()
                except Exception as exc:
                    trace.append(TraceEvent(
                        kind="error",
                        payload={"hypothesis_id": hyp.id, "branch": hyp.branch,
                                 "error": repr(exc)},
                    ))
                    continue
                bs = stats.setdefault(result.branch, BranchStats(branch=result.branch))
                bs.runs += 1
                bs.reward_sum += result.reward
                trace.append(TraceEvent(
                    kind="result",
                    payload={"hypothesis_id": result.hypothesis_id,
                             "branch": result.branch,
                             "reward": result.reward,
                             "branch_mean": bs.mean,
                             "branch_runs": bs.runs},
                ))

                if (not bs.paper_triggered) and bs.mean >= self.paper_threshold and bs.runs >= 1:
                    bs.paper_triggered = True
                    triggers.append(result.branch)
                    trace.append(TraceEvent(
                        kind="paper.trigger",
                        payload={"branch": result.branch, "mean": bs.mean},
                    ))

                if (
                    (not bs.pruned)
                    and bs.runs >= self.prune_after_runs
                    and bs.mean < self.prune_floor
                ):
                    bs.pruned = True
                    queue[:] = [h for h in queue if h.branch != bs.branch]
                    trace.append(TraceEvent(
                        kind="prune",
                        payload={"branch": bs.branch, "mean": bs.mean,
                                 "runs": bs.runs},
                    ))

                if self.expander is not None and result.reward >= self.paper_threshold:
                    followups = self.expander(result)
                    if followups:
                        queue.extend(followups)
                        trace.append(TraceEvent(
                            kind="expand",
                            payload={"branch": result.branch,
                                     "added": [h.id for h in followups]},
                        ))

            if budget_hit():
                stop_reason = "max_experiments"
                break
            if deadline_hit():
                stop_reason = "deadline"
                break

            dispatch_until_full()

        for task in list(in_flight.keys()):
            try:
                result = await task
            except Exception:
                in_flight.pop(task, None)
                continue
            bs = stats.setdefault(result.branch, BranchStats(branch=result.branch))
            bs.runs += 1
            bs.reward_sum += result.reward
            in_flight.pop(task, None)
            if (not bs.paper_triggered) and bs.mean >= self.paper_threshold:
                bs.paper_triggered = True
                triggers.append(result.branch)
                trace.append(TraceEvent(
                    kind="paper.trigger",
                    payload={"branch": result.branch, "mean": bs.mean},
                ))
            trace.append(TraceEvent(
                kind="result.drain",
                payload={"branch": result.branch, "reward": result.reward},
            ))

        if not queue and not in_flight and stop_reason == "queue_empty":
            stop_reason = "queue_empty"

        wall = time.monotonic() - t0
        return SchedulerReport(
            stop_reason=stop_reason,
            experiments_run=experiments_run,
            wall_seconds=wall,
            branches=sorted(stats.values(), key=lambda b: b.branch),
            paper_triggers=triggers,
            trace=trace,
        )


def make_deterministic_runner(
    base_rewards: dict[str, float],
    noise: float = 0.05,
    delay_ms: float = 5.0,
    seed: int = 0,
) -> Runner:
    """Build an async experiment runner whose reward is base_reward + N(0, noise)."""
    rng = np.random.default_rng(seed)

    async def run(hyp: Hypothesis) -> Result:
        base = base_rewards.get(hyp.branch, 0.5)
        bump = float(rng.normal(0.0, noise))
        reward = max(0.0, min(1.0, base + bump))
        await asyncio.sleep(delay_ms / 1000.0)
        return Result(
            hypothesis_id=hyp.id, branch=hyp.branch, reward=reward,
            payload={"base": base, "noise": noise},
        )

    return run


def deterministic_expander(result: Result) -> list[Hypothesis]:
    """Spawn two follow-up hypotheses on the same branch with a monotonic id."""
    return [
        Hypothesis(id=f"{result.hypothesis_id}-f{i}", branch=result.branch,
                   payload={"parent": result.hypothesis_id})
        for i in (1, 2)
    ]


async def demo_async() -> dict:
    seed = [
        Hypothesis(id="h-a-1", branch="branch-a"),
        Hypothesis(id="h-b-1", branch="branch-b"),
        Hypothesis(id="h-c-1", branch="branch-c"),
        Hypothesis(id="h-d-1", branch="branch-d"),
    ]
    runner = make_deterministic_runner(
        base_rewards={"branch-a": 0.85, "branch-b": 0.55, "branch-c": 0.15, "branch-d": 0.40},
        seed=7, delay_ms=2.0,
    )
    sched = IterationScheduler(
        runner=runner, slots=3, max_experiments=20,
        paper_threshold=0.7, prune_floor=0.25, prune_after_runs=3,
        expander=deterministic_expander,
    )
    report = await sched.run(seed)
    return report.to_dict()


def demo() -> dict:
    return asyncio.run(demo_async())


if __name__ == "__main__":
    r = demo()
    print(json.dumps({
        "stop_reason": r["stop_reason"],
        "experiments_run": r["experiments_run"],
        "wall_seconds": r["wall_seconds"],
        "paper_triggers": r["paper_triggers"],
        "branches": r["branches"],
    }, indent=2))
