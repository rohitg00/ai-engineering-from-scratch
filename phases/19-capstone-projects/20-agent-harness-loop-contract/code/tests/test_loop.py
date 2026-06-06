"""Tests for HarnessLoop state machine, hooks, events, budget."""

from __future__ import annotations

import os
import sys
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    HOOK_TOPICS,
    Budget,
    HarnessLoop,
    HookAbort,
    PullRequest,
    SessionResult,
    State,
    Step,
)


def linear_planner(goal, history):
    if history:
        return []
    return [
        Step(id=1, description="step1", requires_tool=False),
        Step(id=2, description="step2", requires_tool=False),
        Step(id=3, description="step3", requires_tool=False),
    ]


def two_tool_planner(goal, history):
    if history:
        return []
    return [
        Step(id=1, description="prep", requires_tool=False),
        Step(id=2, description="fetch", requires_tool=True, tool_name="t.fetch", tool_args={}),
        Step(id=3, description="render", requires_tool=True, tool_name="t.render", tool_args={}),
    ]


class TestStateTransitions(unittest.TestCase):
    def test_idle_to_done_linear(self) -> None:
        loop = HarnessLoop(planner=linear_planner)
        result = loop.run("g")
        self.assertIsInstance(result, SessionResult)
        self.assertEqual(result.state, State.DONE)
        self.assertEqual(result.reason, "goal_met")

    def test_run_twice_raises(self) -> None:
        loop = HarnessLoop(planner=linear_planner)
        loop.run("g")
        with self.assertRaises(RuntimeError):
            loop.run("again")

    def test_tool_pull_point_then_resume(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        out = loop.run("g")
        self.assertIsInstance(out, PullRequest)
        self.assertEqual(out.reason, "tool_call")
        self.assertEqual(loop.state, State.AWAITING_TOOL)
        out2 = loop.resume({"result": 1})
        self.assertIsInstance(out2, PullRequest)
        final = loop.resume({"result": 2})
        self.assertIsInstance(final, SessionResult)
        self.assertEqual(final.state, State.DONE)

    def test_resume_requires_payload(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        loop.run("g")
        with self.assertRaises(ValueError):
            loop.resume(None)

    def test_illegal_transition_rejected(self) -> None:
        loop = HarnessLoop(planner=linear_planner)
        with self.assertRaises(RuntimeError):
            loop._transition(State.DONE)

    def test_empty_plan_completes(self) -> None:
        def empty(goal, history):
            return []
        loop = HarnessLoop(planner=empty)
        result = loop.run("g")
        self.assertIsInstance(result, SessionResult)
        self.assertEqual(result.reason, "no_plan")


class TestHooks(unittest.TestCase):
    def test_all_topics_register(self) -> None:
        loop = HarnessLoop()
        for t in HOOK_TOPICS:
            loop.hooks.on(t, lambda p: None)

    def test_unknown_topic_rejected(self) -> None:
        loop = HarnessLoop()
        with self.assertRaises(ValueError):
            loop.hooks.on("not_a_topic", lambda p: None)

    def test_hook_firing_order_linear(self) -> None:
        loop = HarnessLoop(planner=linear_planner)
        seen: list[str] = []
        for t in HOOK_TOPICS:
            loop.hooks.on(t, lambda p, t=t: seen.append(t))
        loop.run("g")
        self.assertEqual(seen[0], "before_plan")
        self.assertEqual(seen[1], "after_plan")
        self.assertEqual(seen[-1], "on_complete")
        self.assertEqual(seen.count("before_step"), 3)
        self.assertEqual(seen.count("after_step"), 3)
        self.assertNotIn("before_tool_call", seen)

    def test_before_tool_call_fires_per_tool_step(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        before: list[int] = []
        after: list[int] = []
        loop.hooks.on("before_tool_call", lambda p: before.append(p["step"].id))
        loop.hooks.on("after_tool_call", lambda p: after.append(p["step"].id))
        loop.run("g")
        loop.resume({"result": "a"})
        loop.resume({"result": "b"})
        self.assertEqual(before, [2, 3])
        self.assertEqual(after, [2, 3])

    def test_hook_abort_skips_tool_call(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        errors: list[str] = []
        loop.hooks.on("on_error", lambda p: errors.append(p["error"]))

        def block(p):
            raise HookAbort("policy_denied")
        loop.hooks.on("before_tool_call", block)
        result = loop.run("g")
        self.assertIsInstance(result, SessionResult)
        self.assertEqual(len(errors), 2)
        self.assertTrue(errors[0].startswith("hook_abort"))


class TestEvents(unittest.TestCase):
    def test_event_stream_shape(self) -> None:
        loop = HarnessLoop(planner=linear_planner)
        loop.run("g")
        types = [e.type for e in loop.events]
        self.assertEqual(types[0], "session.start")
        self.assertIn("plan.draft", types)
        self.assertIn("plan.commit", types)
        self.assertIn("step.start", types)
        self.assertIn("step.end", types)
        self.assertEqual(types[-1], "session.complete")

    def test_tool_events_emitted(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        loop.run("g")
        loop.resume({"result": "x"})
        loop.resume({"result": "y"})
        types = [e.type for e in loop.events]
        self.assertEqual(types.count("tool.call"), 2)
        self.assertEqual(types.count("tool.result"), 2)
        self.assertNotIn("tool.error", types)

    def test_tool_error_recorded(self) -> None:
        loop = HarnessLoop(planner=two_tool_planner)
        loop.run("g")
        loop.resume({"error": "boom"})
        types = [e.type for e in loop.events]
        self.assertIn("tool.error", types)


class TestBudget(unittest.TestCase):
    def test_turn_limit_paused(self) -> None:
        budget = Budget(max_turns=1, max_tool_calls=10, max_wall_seconds=10.0)
        loop = HarnessLoop(planner=linear_planner, budget=budget)
        result = loop.run("g")
        self.assertIsInstance(result, PullRequest)
        self.assertTrue(result.reason.startswith("budget_exceeded"))

    def test_tool_call_limit_paused(self) -> None:
        budget = Budget(max_turns=10, max_tool_calls=1, max_wall_seconds=10.0)
        loop = HarnessLoop(planner=two_tool_planner, budget=budget)
        out = loop.run("g")
        self.assertIsInstance(out, PullRequest)
        out2 = loop.resume({"result": "x"})
        self.assertIsInstance(out2, PullRequest)
        self.assertTrue(out2.reason.startswith("budget_exceeded"))

    def test_wall_clock_check(self) -> None:
        budget = Budget(max_turns=10, max_tool_calls=10, max_wall_seconds=0.0)
        loop = HarnessLoop(planner=linear_planner, budget=budget)
        result = loop.run("g")
        self.assertIsInstance(result, PullRequest)
        self.assertEqual(result.reason, "budget_exceeded:wall_clock")


class TestDeterminism(unittest.TestCase):
    def test_same_inputs_same_event_types(self) -> None:
        a = HarnessLoop(planner=linear_planner).run("g")
        b = HarnessLoop(planner=linear_planner).run("g")
        self.assertIsInstance(a, SessionResult)
        self.assertIsInstance(b, SessionResult)
        a_types = [e.type for e in a.events]
        b_types = [e.type for e in b.events]
        self.assertEqual(a_types, b_types)


if __name__ == "__main__":
    unittest.main()
