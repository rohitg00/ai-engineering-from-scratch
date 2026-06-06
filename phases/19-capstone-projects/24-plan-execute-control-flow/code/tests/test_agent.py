"""Tests for PlanExecuteAgent: linear, replan, replan exhaustion, step budget, diffs."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    PlanDiff,
    PlanExecuteAgent,
    SessionResult,
    Step,
    ToolFailure,
    make_deterministic_planner,
)


def perfect_executor(tool, args):
    return f"ok:{tool}"


class TestLinear(unittest.TestCase):
    def test_linear_plan_completes(self) -> None:
        agent = PlanExecuteAgent(
            planner=make_deterministic_planner(fail_step_id=None),
            executor=perfect_executor,
        )
        res = agent.run("g")
        self.assertEqual(res.status, "completed")
        self.assertEqual(res.reason, "goal_met")
        self.assertEqual(len(res.history), 4)
        self.assertEqual([s.id for s in res.history], [1, 2, 3, 4])
        self.assertEqual(res.revisions, [])

    def test_no_plan_initial(self) -> None:
        def empty(g, h, e):
            return []
        agent = PlanExecuteAgent(planner=empty, executor=perfect_executor)
        res = agent.run("g")
        self.assertEqual(res.status, "failed")
        self.assertEqual(res.reason, "no_plan")


class TestReplan(unittest.TestCase):
    def test_replan_once_on_transform_failure(self) -> None:
        calls = {"transform_v1": 0, "transform_v2": 0}

        def executor(tool, args):
            if tool == "transform":
                mode = args.get("mode")
                if mode == "v1":
                    calls["transform_v1"] += 1
                    raise ToolFailure("transform v1 down")
                if mode == "v2":
                    calls["transform_v2"] += 1
                    return "ok"
                raise ToolFailure("transform unknown mode")
            return f"ok:{tool}"

        agent = PlanExecuteAgent(
            planner=make_deterministic_planner(fail_step_id=2, recovery="route_around"),
            executor=executor,
        )
        res = agent.run("g")
        self.assertEqual(res.status, "completed")
        self.assertEqual(res.reason, "goal_met")
        self.assertEqual(calls["transform_v1"], 1)
        self.assertEqual(calls["transform_v2"], 1)
        self.assertEqual(len(res.revisions), 1)

    def test_replan_diff_event_emitted(self) -> None:
        def executor(tool, args):
            if tool == "transform" and args.get("mode") == "v1":
                raise ToolFailure("transform v1 boom")
            return "ok"

        agent = PlanExecuteAgent(
            planner=make_deterministic_planner(None, recovery="route_around"),
            executor=executor,
        )
        res = agent.run("g")
        diff_events = [e for e in res.events if e.type == "plan.diff"]
        self.assertEqual(len(diff_events), 1)
        diff = diff_events[0].payload
        self.assertEqual(diff["revision"], 1)
        self.assertIn("removed", diff)
        self.assertIn("added", diff)
        self.assertIn("revised", diff)
        self.assertIn(2, diff["revised"])

    def test_replan_exhaustion_returns_failed(self) -> None:
        def always_bad(tool, args):
            if tool == "transform":
                raise ToolFailure("nope")
            return "ok"

        def planner(g, h, e):
            if e is None:
                return [
                    Step(1, "fetch", {}, "fetch"),
                    Step(2, "transform", {"mode": "v1"}, "transform"),
                ]
            return [
                Step(2, "transform", {"mode": "v1"}, "transform again"),
            ]

        agent = PlanExecuteAgent(planner=planner, executor=always_bad, max_replans=2, max_steps=50)
        res = agent.run("g")
        self.assertEqual(res.status, "failed")
        self.assertEqual(res.reason, "replan_budget")


class TestBudgets(unittest.TestCase):
    def test_step_budget_caps_execution(self) -> None:
        def planner(g, h, e):
            return [Step(i, "noop", {}, "noop") for i in range(20)]

        agent = PlanExecuteAgent(planner=planner, executor=perfect_executor, max_steps=5)
        res = agent.run("g")
        self.assertEqual(res.status, "failed")
        self.assertEqual(res.reason, "step_budget")
        self.assertEqual(len(res.history), 5)

    def test_max_replans_zero_returns_after_first_failure(self) -> None:
        def planner(g, h, e):
            return [Step(1, "bad", {}, "bad")]

        def boom(tool, args):
            raise ToolFailure("nope")

        agent = PlanExecuteAgent(planner=planner, executor=boom, max_replans=0)
        res = agent.run("g")
        self.assertEqual(res.status, "failed")
        self.assertEqual(res.reason, "replan_budget")


class TestEvents(unittest.TestCase):
    def test_event_order(self) -> None:
        agent = PlanExecuteAgent(
            planner=make_deterministic_planner(None),
            executor=perfect_executor,
        )
        res = agent.run("g")
        types = [e.type for e in res.events]
        self.assertEqual(types[0], "plan.commit")
        self.assertEqual(types[-1], "session.complete")
        self.assertEqual(types.count("step.start"), 4)
        self.assertEqual(types.count("step.end"), 4)


if __name__ == "__main__":
    unittest.main()
