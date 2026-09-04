"""Tests for the deterministic Associate capstone validator."""

from __future__ import annotations

import copy
import sys
import unittest
from datetime import date
from pathlib import Path


CODE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))

from main import build_demo_packet, evaluate_packet  # noqa: E402


AS_OF = date(2026, 8, 8)


class WorkflowValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.packet = build_demo_packet()

    def codes(self, result: dict) -> set[str]:
        return {item["code"] for item in result["findings"]}

    def test_demo_packet_is_ready_for_human_review(self) -> None:
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("ready_for_human_review", result["status"])
        self.assertEqual(0, result["metrics"]["errors"])

    def test_unapproved_surface_blocks_release(self) -> None:
        self.packet["governance"]["approved_surface"] = False
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("unapproved_surface", self.codes(result))

    def test_unknown_claim_source_blocks_release(self) -> None:
        self.packet["claims"][0]["source_ids"] = ["missing-source"]
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("unknown_source", self.codes(result))

    def test_speculative_consequential_claim_blocks_release(self) -> None:
        self.packet["claims"][0]["support"] = "speculative"
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("unsupported_consequential_claim", self.codes(result))

    def test_high_consequence_work_requires_decision_owner(self) -> None:
        self.packet["governance"]["decision_owner"] = ""
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("missing_decision_owner", self.codes(result))

    def test_irreversible_work_requires_decision_owner(self) -> None:
        self.packet["governance"]["consequence"] = "low"
        self.packet["governance"]["reversible"] = False
        self.packet["governance"]["decision_owner"] = None
        result = evaluate_packet(self.packet, AS_OF)
        self.assertIn("missing_decision_owner", self.codes(result))

    def test_stale_source_requires_revision_not_release(self) -> None:
        self.packet["sources"][0]["review_date"] = "2026-08-01"
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("needs_revision", result["status"])
        self.assertIn("stale_source", self.codes(result))

    def test_restricted_data_requires_explicit_processing_approval(self) -> None:
        self.packet["governance"]["data_class"] = "restricted"
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("restricted_data_not_approved", self.codes(result))

    def test_missing_handoff_fallback_blocks_release(self) -> None:
        del self.packet["handoff"]["fallback"]
        result = evaluate_packet(self.packet, AS_OF)
        self.assertEqual("blocked", result["status"])
        self.assertIn("missing_handoff_field", self.codes(result))

    def test_validation_does_not_mutate_packet(self) -> None:
        before = copy.deepcopy(self.packet)
        evaluate_packet(self.packet, AS_OF)
        self.assertEqual(before, self.packet)


if __name__ == "__main__":
    unittest.main()
