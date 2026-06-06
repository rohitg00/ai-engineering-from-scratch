"""Tests for the iteration scheduler: UCB picks, parallel slots, fan-out, pruning, budgets."""

from __future__ import annotations

import asyncio
import math
import os
import sys
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BranchStats,
    Hypothesis,
    IterationScheduler,
    Result,
    deterministic_expander,
    make_deterministic_runner,
    ucb_score,
)


def aio_run(coro):
    return asyncio.run(coro)


class TestUCB(unittest.TestCase):
    def test_zero_runs_branch_scores_infinity(self) -> None:
        bs = BranchStats(branch="x", runs=0, reward_sum=0.0)
        self.assertEqual(ucb_score(bs, 10, math.sqrt(2.0)), float("inf"))

    def test_high_mean_dominates_low_mean_with_equal_runs(self) -> None:
        a = BranchStats(branch="a", runs=5, reward_sum=4.5)
        b = BranchStats(branch="b", runs=5, reward_sum=1.0)
        self.assertGreater(
            ucb_score(a, 10, math.sqrt(2.0)),
            ucb_score(b, 10, math.sqrt(2.0)),
        )

    def test_exploration_bonus_helps_less_run_branch(self) -> None:
        a = BranchStats(branch="a", runs=100, reward_sum=50.0)
        b = BranchStats(branch="b", runs=2, reward_sum=1.0)
        self.assertGreater(
            ucb_score(b, 102, math.sqrt(2.0)),
            ucb_score(a, 102, math.sqrt(2.0)),
        )


class TestScheduling(unittest.TestCase):
    def test_untried_branches_are_picked_before_repeating(self) -> None:
        async def go():
            seen_branches: list[str] = []

            async def runner(hyp: Hypothesis) -> Result:
                seen_branches.append(hyp.branch)
                await asyncio.sleep(0.001)
                return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.6)

            seed = [
                Hypothesis(id="a", branch="A"),
                Hypothesis(id="b", branch="B"),
                Hypothesis(id="c", branch="C"),
                Hypothesis(id="a2", branch="A"),
                Hypothesis(id="b2", branch="B"),
                Hypothesis(id="c2", branch="C"),
            ]
            sched = IterationScheduler(
                runner=runner, slots=1, max_experiments=6, paper_threshold=0.99,
                prune_floor=-1.0,
            )
            await sched.run(seed)
            return seen_branches

        seen = aio_run(go())
        self.assertEqual(set(seen[:3]), {"A", "B", "C"})

    def test_parallel_slots_advance_wall_clock_less_than_serial(self) -> None:
        async def slow_runner(hyp: Hypothesis) -> Result:
            await asyncio.sleep(0.05)
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.6)

        async def go(slots: int) -> float:
            seed = [Hypothesis(id=f"h{i}", branch=f"b{i}") for i in range(6)]
            sched = IterationScheduler(
                runner=slow_runner, slots=slots, max_experiments=6,
                paper_threshold=2.0, prune_floor=-1.0,
            )
            t0 = time.monotonic()
            await sched.run(seed)
            return time.monotonic() - t0

        serial = aio_run(go(1))
        parallel = aio_run(go(3))
        self.assertLess(parallel, serial * 0.7)


class TestFanout(unittest.TestCase):
    def test_paper_trigger_fires_when_threshold_crossed(self) -> None:
        async def runner(hyp: Hypothesis) -> Result:
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.9)

        async def go():
            seed = [Hypothesis(id="h1", branch="b1")]
            sched = IterationScheduler(
                runner=runner, slots=1, max_experiments=1,
                paper_threshold=0.7, prune_floor=-1.0,
            )
            return await sched.run(seed)

        report = aio_run(go())
        self.assertIn("b1", report.paper_triggers)

    def test_paper_trigger_only_fires_once_per_branch(self) -> None:
        async def runner(hyp: Hypothesis) -> Result:
            return Result(hypothesis_id=hyp.id, branch="b1", reward=0.9)

        async def go():
            seed = [Hypothesis(id=f"h{i}", branch="b1") for i in range(4)]
            sched = IterationScheduler(
                runner=runner, slots=1, max_experiments=4,
                paper_threshold=0.5, prune_floor=-1.0,
            )
            return await sched.run(seed)

        report = aio_run(go())
        self.assertEqual(report.paper_triggers, ["b1"])

    def test_expander_adds_followups(self) -> None:
        async def runner(hyp: Hypothesis) -> Result:
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.9)

        async def go():
            seed = [Hypothesis(id="h1", branch="b1")]
            sched = IterationScheduler(
                runner=runner, slots=1, max_experiments=5,
                paper_threshold=0.7, prune_floor=-1.0,
                expander=deterministic_expander,
            )
            return await sched.run(seed)

        report = aio_run(go())
        b1 = next(b for b in report.branches if b.branch == "b1")
        self.assertGreater(b1.runs, 1)


class TestPruning(unittest.TestCase):
    def test_low_yield_branch_is_pruned_after_threshold_runs(self) -> None:
        async def runner(hyp: Hypothesis) -> Result:
            reward = 0.9 if hyp.branch == "good" else 0.05
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=reward)

        async def go():
            seed = [Hypothesis(id=f"g{i}", branch="good") for i in range(5)] + \
                   [Hypothesis(id=f"b{i}", branch="bad") for i in range(5)]
            sched = IterationScheduler(
                runner=runner, slots=2, max_experiments=20,
                paper_threshold=0.95, prune_floor=0.2, prune_after_runs=3,
            )
            return await sched.run(seed)

        report = aio_run(go())
        bad = next(b for b in report.branches if b.branch == "bad")
        self.assertTrue(bad.pruned)


class TestBudgets(unittest.TestCase):
    def test_max_experiments_caps_total_runs(self) -> None:
        async def runner(hyp: Hypothesis) -> Result:
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.5)

        async def go():
            seed = [Hypothesis(id=f"h{i}", branch=f"b{i}") for i in range(50)]
            sched = IterationScheduler(
                runner=runner, slots=4, max_experiments=10,
                paper_threshold=2.0, prune_floor=-1.0,
            )
            return await sched.run(seed)

        report = aio_run(go())
        self.assertEqual(report.experiments_run, 10)
        self.assertEqual(report.stop_reason, "max_experiments")

    def test_deadline_caps_wall_clock(self) -> None:
        async def slow_runner(hyp: Hypothesis) -> Result:
            await asyncio.sleep(0.05)
            return Result(hypothesis_id=hyp.id, branch=hyp.branch, reward=0.5)

        async def go():
            seed = [Hypothesis(id=f"h{i}", branch=f"b{i}") for i in range(100)]
            sched = IterationScheduler(
                runner=slow_runner, slots=2, max_experiments=1000,
                paper_threshold=2.0, prune_floor=-1.0, max_seconds=0.12,
            )
            return await sched.run(seed)

        report = aio_run(go())
        self.assertEqual(report.stop_reason, "deadline")
        self.assertLess(report.wall_seconds, 1.0)


class TestRunner(unittest.TestCase):
    def test_deterministic_runner_rewards_in_unit_interval(self) -> None:
        runner = make_deterministic_runner(
            base_rewards={"x": 0.8}, noise=0.1, delay_ms=1.0, seed=0,
        )

        async def go():
            return await runner(Hypothesis(id="h", branch="x"))

        r = aio_run(go())
        self.assertGreaterEqual(r.reward, 0.0)
        self.assertLessEqual(r.reward, 1.0)


if __name__ == "__main__":
    unittest.main()
