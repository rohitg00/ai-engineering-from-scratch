"""Tests for the toy ReWOO lesson (docs/en.md, exercises 1 and 2).

Run from the code/ directory: python3 -m unittest discover tests -v
"""

import asyncio
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import (  # noqa: E402
    Plan,
    PlanStep,
    ScriptedPlanner,
    ScriptedSolver,
    ToolRegistry,
    broken_plan,
    run_rewoo,
    run_workers,
    run_workers_sequential,
    six_node_plan,
    slow_search,
    topological,
)


def ids(batches):
    return [[s.id for s in b] for b in batches]


def slow_tools() -> ToolRegistry:
    tools = ToolRegistry()
    tools.register("slow", slow_search)
    return tools


class TopologicalTests(unittest.TestCase):
    def test_chain_gives_one_step_per_level(self):
        plan = Plan(steps=[
            PlanStep("E1", "slow", {"query": "a"}),
            PlanStep("E2", "slow", {"query": "uses #E1"}),
            PlanStep("E3", "slow", {"query": "uses #E2"}),
        ])
        self.assertEqual(ids(topological(plan)), [["E1"], ["E2"], ["E3"]])

    def test_independent_steps_share_a_level(self):
        self.assertEqual(ids(topological(six_node_plan())),
                         [["E1", "E2", "E3"], ["E4", "E5", "E6"]])

    def test_step_never_shares_a_level_with_its_dependency(self):
        # E2 is listed right after E1 but needs it, so it must wait a level.
        plan = Plan(steps=[
            PlanStep("E1", "slow", {"query": "a"}),
            PlanStep("E2", "slow", {"query": "uses #E1"}),
        ])
        self.assertEqual(ids(topological(plan)), [["E1"], ["E2"]])

    def test_cycle_is_rejected(self):
        plan = Plan(steps=[
            PlanStep("E1", "slow", {"query": "uses #E2"}),
            PlanStep("E2", "slow", {"query": "uses #E1"}),
        ])
        with self.assertRaises(RuntimeError):
            topological(plan)


class ParallelWorkerTests(unittest.TestCase):
    def test_parallel_matches_sequential_evidence(self):
        tools = slow_tools()
        plan = six_node_plan()
        self.assertEqual(asyncio.run(run_workers(plan, tools)),
                         run_workers_sequential(plan, tools))

    def test_parallel_is_faster_than_sequential(self):
        # 6 calls * 0.2s = 1.2s sequential; 2 levels * 0.2s = ~0.4s parallel.
        # The bound is loose so a slow machine does not make this flaky.
        tools = slow_tools()
        t0 = time.perf_counter()
        asyncio.run(run_workers(six_node_plan(), tools))
        self.assertLess(time.perf_counter() - t0, 0.9)

    def test_dependent_step_sees_its_dependency_result(self):
        evidence = asyncio.run(run_workers(six_node_plan(), slow_tools()))
        self.assertEqual(evidence["E4"], "result(uses result(a))")


class ReplanTests(unittest.TestCase):
    def solver(self) -> ScriptedSolver:
        return ScriptedSolver("E1={E1}")

    def test_broken_plan_errors_without_replan(self):
        planner = ScriptedPlanner(broken_plan(), fixed_plan=six_node_plan())
        run = run_rewoo("q", planner, slow_tools(), self.solver())
        self.assertTrue(run.evidence["E1"].startswith("error:"))

    def test_replan_recovers_from_error(self):
        planner = ScriptedPlanner(broken_plan(), fixed_plan=six_node_plan())
        run = run_rewoo("q", planner, slow_tools(), self.solver(),
                        max_replans=2)
        self.assertEqual(run.evidence["E1"], "result(a)")
        self.assertEqual(run.answer, "E1=result(a)")

    def test_returned_plan_matches_returned_evidence(self):
        planner = ScriptedPlanner(broken_plan(), fixed_plan=six_node_plan())
        run = run_rewoo("q", planner, slow_tools(), self.solver(),
                        max_replans=2)
        self.assertEqual(run.plan.steps[0].tool, "slow")

    def test_replan_stops_at_the_cap_when_fix_never_works(self):
        calls = []

        class StubbornPlanner(ScriptedPlanner):
            def replan(self, question, plan, evidence):
                calls.append(1)
                return plan  # same broken plan every time

        planner = StubbornPlanner(broken_plan())
        run = run_rewoo("q", planner, slow_tools(), self.solver(),
                        max_replans=2)
        self.assertEqual(len(calls), 2)
        self.assertTrue(run.evidence["E1"].startswith("error:"))

    def test_no_replan_on_clean_run(self):
        calls = []

        class CountingPlanner(ScriptedPlanner):
            def replan(self, question, plan, evidence):
                calls.append(1)
                return plan

        planner = CountingPlanner(six_node_plan())
        run_rewoo("q", planner, slow_tools(), self.solver(), max_replans=2)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
