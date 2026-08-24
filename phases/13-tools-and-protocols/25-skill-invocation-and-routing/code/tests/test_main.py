"""Deterministic tests for Lesson 25 invocation policy adapters."""

from __future__ import annotations

import sys
import unittest
import argparse
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    Actor,
    CorePolicyAdapter,
    ExtensionPolicyAdapter,
    InvocationPolicy,
    InvocationRequest,
    SkillMetadata,
    build_invocation_matrix,
    relevance_score,
    route_request,
)


SKILLS = (
    SkillMetadata("incident-triage", "Triage incident timeline evidence."),
    SkillMetadata("release-notes", "Draft release notes from merged changes."),
)


def load_bundled_router(module_name: str):
    script_path = (
        Path(__file__).resolve().parents[2]
        / "outputs"
        / "skill-invocation-router"
        / "scripts"
        / "simulate_invocation.py"
    )
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load bundled router from {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InvocationTests(unittest.TestCase):
    def test_matrix_contains_all_human_model_quadrants(self) -> None:
        matrix = build_invocation_matrix()
        pairs = {(row["human"], row["model"]) for row in matrix}
        self.assertEqual(pairs, {(False, False), (True, False), (False, True), (True, True)})

    def test_human_activation_requires_exact_name(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.HUMAN, "please triage"),
            CorePolicyAdapter(InvocationPolicy()),
        )
        self.assertFalse(decision.activated)
        self.assertIn("exact skill name", decision.reason)

    def test_human_explicit_activation_succeeds(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.HUMAN, "", "release-notes"),
            CorePolicyAdapter(InvocationPolicy()),
        )
        self.assertTrue(decision.activated)
        self.assertEqual(decision.mode, "explicit-human")

    def test_model_routes_by_description_relevance(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.MODEL, "triage this incident timeline evidence"),
            CorePolicyAdapter(InvocationPolicy(model_threshold=0.1)),
        )
        self.assertTrue(decision.activated)
        self.assertEqual(decision.skill_name, "incident-triage")

    def test_agent_routes_by_description_relevance(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.AGENT, "triage this incident timeline evidence"),
            CorePolicyAdapter(InvocationPolicy(model_threshold=0.1)),
        )
        self.assertTrue(decision.activated)
        self.assertEqual(decision.mode, "implicit-agent")

    def test_near_miss_below_threshold_does_not_activate(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.MODEL, "translate a poem"),
            CorePolicyAdapter(InvocationPolicy(model_threshold=0.1)),
        )
        self.assertFalse(decision.activated)
        self.assertEqual(decision.score, 0.0)

    def test_programmatic_activation_obeys_allowlist(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(harness_allowlist=("incident-triage",))
        )
        allowed = route_request(
            SKILLS, InvocationRequest(Actor.HARNESS, "", "incident-triage"), adapter
        )
        blocked = route_request(
            SKILLS, InvocationRequest(Actor.HARNESS, "", "release-notes"), adapter
        )
        self.assertTrue(allowed.activated)
        self.assertFalse(blocked.activated)

    def test_application_activation_requires_exact_target_allowlist(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(application_allowlist=("release-notes",))
        )
        allowed = route_request(
            SKILLS,
            InvocationRequest(Actor.APPLICATION, "", "release-notes"),
            adapter,
        )
        blocked = route_request(
            SKILLS,
            InvocationRequest(Actor.APPLICATION, "", "incident-triage"),
            adapter,
        )
        self.assertTrue(allowed.activated)
        self.assertEqual(allowed.mode, "programmatic-application")
        self.assertFalse(blocked.activated)

    def test_skill_composition_requires_caller_and_depth_policy(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(
                allow_skill=True,
                skill_caller_allowlist=("release-readiness",),
                max_skill_depth=2,
            )
        )
        allowed = route_request(
            SKILLS,
            InvocationRequest(
                Actor.SKILL,
                "",
                "incident-triage",
                caller_name="release-readiness",
                depth=1,
            ),
            adapter,
        )
        blocked = route_request(
            SKILLS,
            InvocationRequest(
                Actor.SKILL,
                "",
                "incident-triage",
                caller_name="release-readiness",
                depth=3,
            ),
            adapter,
        )
        self.assertTrue(allowed.activated)
        self.assertEqual(allowed.mode, "composed-skill")
        self.assertFalse(blocked.activated)
        self.assertIn("depth", blocked.reason)

    def test_skill_composition_rejects_direct_cycle(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(
                allow_skill=True,
                skill_caller_allowlist=("incident-triage",),
            )
        )
        decision = route_request(
            SKILLS,
            InvocationRequest(
                Actor.SKILL,
                "",
                "incident-triage",
                caller_name="incident-triage",
                depth=1,
            ),
            adapter,
        )
        self.assertFalse(decision.activated)
        self.assertIn("self-cycle", decision.reason)

    def test_empty_harness_allowlist_denies_programmatic_activation(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.HARNESS, "", "incident-triage"),
            CorePolicyAdapter(InvocationPolicy()),
        )
        self.assertFalse(decision.activated)

    def test_unknown_actor_does_not_inherit_harness_authority(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(harness_allowlist=("incident-triage",))
        )
        for actor in (SimpleNamespace(value="future"), "future", None, object()):
            with self.subTest(actor=actor):
                allowed, reason = adapter.allows(SKILLS[0], actor)
                self.assertFalse(allowed)
                self.assertIn("unknown actor", reason)

    def test_unknown_actor_routes_to_a_serializable_deny_decision(self) -> None:
        adapter = CorePolicyAdapter(
            InvocationPolicy(harness_allowlist=("incident-triage",))
        )
        cases = (
            (SimpleNamespace(value="future"), "future"),
            ("future", "future"),
            (None, "unknown"),
            (object(), "object"),
        )
        for actor, expected in cases:
            with self.subTest(actor=expected):
                decision = route_request(
                    SKILLS,
                    InvocationRequest(actor, "", "incident-triage"),
                    adapter,
                )
                payload = decision.to_dict()
                self.assertFalse(decision.activated)
                self.assertEqual(decision.mode, "unsupported-actor")
                self.assertEqual(payload["actor"], expected)
                self.assertEqual(json.loads(json.dumps(payload)), payload)

    def test_policy_rejects_invalid_threshold_and_boolean_types(self) -> None:
        with self.assertRaises(ValueError):
            InvocationPolicy(model_threshold=-0.1)
        with self.assertRaises(TypeError):
            InvocationPolicy(allow_model="false")
        with self.assertRaises(TypeError):
            InvocationPolicy(application_allowlist=["release-notes"])
        with self.assertRaises(ValueError):
            InvocationPolicy(max_skill_depth=0)

    def test_core_adapter_does_not_invent_extension_semantics(self) -> None:
        skill = SkillMetadata("private-review", "Review a private report.", {"user-invocable": False})
        decision = route_request(
            (skill,),
            InvocationRequest(Actor.HUMAN, "", "private-review"),
            CorePolicyAdapter(InvocationPolicy()),
        )
        self.assertTrue(decision.activated)

    def test_extension_adapter_can_disable_human_activation(self) -> None:
        skill = SkillMetadata("private-review", "Review a private report.", {"user-invocable": False})
        decision = route_request(
            (skill,),
            InvocationRequest(Actor.HUMAN, "", "private-review"),
            ExtensionPolicyAdapter(InvocationPolicy()),
        )
        self.assertFalse(decision.activated)
        self.assertIn("user-invocable", decision.reason)

    def test_extension_adapter_can_disable_model_activation(self) -> None:
        skill = SkillMetadata(
            "private-review",
            "Review a private report.",
            {"disable-model-invocation": "true"},
        )
        decision = route_request(
            (skill,),
            InvocationRequest(Actor.MODEL, "review this private report"),
            ExtensionPolicyAdapter(InvocationPolicy(model_threshold=0.1)),
        )
        self.assertFalse(decision.activated)
        self.assertIn("disable-model-invocation", decision.reason)

    def test_implicit_routing_ranks_only_eligible_candidates(self) -> None:
        blocked = SkillMetadata(
            "incident-triage",
            "Triage incident timeline evidence.",
            {"disable-model-invocation": True},
        )
        eligible = SkillMetadata(
            "incident-review",
            "Review incident evidence and report findings.",
        )
        query = "triage this incident timeline evidence"
        self.assertGreater(
            relevance_score(query, blocked), relevance_score(query, eligible)
        )

        decision = route_request(
            (blocked, eligible),
            InvocationRequest(Actor.MODEL, query),
            ExtensionPolicyAdapter(InvocationPolicy(model_threshold=0.1)),
        )

        self.assertTrue(decision.activated)
        self.assertEqual(decision.skill_name, "incident-review")
        self.assertEqual(decision.mode, "implicit-model")

    def test_implicit_routing_reports_when_no_candidate_is_eligible(self) -> None:
        decision = route_request(
            SKILLS,
            InvocationRequest(Actor.MODEL, "triage incident timeline evidence"),
            CorePolicyAdapter(InvocationPolicy(allow_model=False)),
        )

        self.assertFalse(decision.activated)
        self.assertIsNone(decision.skill_name)
        self.assertEqual(decision.score, 0.0)
        self.assertIn("no discovered skill is eligible", decision.reason)

    def test_relevance_score_is_deterministic(self) -> None:
        skill = SKILLS[0]
        self.assertEqual(
            relevance_score("triage incident", skill),
            relevance_score("triage incident", skill),
        )

    def test_bundled_router_enforces_recognized_invocation_extension(self) -> None:
        module = load_bundled_router("bundled_router")
        args = argparse.Namespace(
            actor="human",
            name="release-notes",
            description="Draft release notes.",
            query="",
            explicit_name="release-notes",
            user_invocable="false",
            disable_model_invocation=None,
        )
        policy = {
            "allowHuman": True,
            "recognizedExtensions": ["user-invocable"],
        }
        decision = module.decide(args, policy)
        self.assertFalse(decision["activated"])
        self.assertIn("user-invocable", decision["reason"])
        self.assertEqual(decision["adapter"], "host-extension-policy")

    def test_bundled_router_rejects_invalid_policy_types(self) -> None:
        module = load_bundled_router("bundled_router_invalid")
        args = argparse.Namespace(
            actor="model",
            name="release-notes",
            description="Draft release notes.",
            query="translate a poem",
            explicit_name=None,
            user_invocable=None,
            disable_model_invocation=None,
        )
        with self.assertRaises(ValueError):
            module.decide(args, {"allowModel": "false", "modelThreshold": -1})

    def test_bundled_router_checks_eligibility_before_relevance(self) -> None:
        module = load_bundled_router("bundled_router_order")
        args = argparse.Namespace(
            actor="model",
            name="release-notes",
            description="Draft release notes from merged changes.",
            query="draft release notes from merged changes",
            explicit_name=None,
            user_invocable=None,
            disable_model_invocation="true",
        )
        policy = {
            "allowModel": True,
            "modelThreshold": 0.1,
            "recognizedExtensions": ["disable-model-invocation"],
        }

        decision = module.decide(args, policy)

        self.assertFalse(decision["activated"])
        self.assertEqual(decision["score"], 0.0)
        self.assertIn("disable-model-invocation", decision["reason"])


if __name__ == "__main__":
    unittest.main()
