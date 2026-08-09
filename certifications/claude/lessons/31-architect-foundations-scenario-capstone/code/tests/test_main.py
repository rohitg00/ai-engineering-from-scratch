"""Failure-first tests for the Architect Foundations scenario validator."""

from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path


CODE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))

from main import build_demo_packet, evaluate_packet  # noqa: E402


class ArchitecturePacketTests(unittest.TestCase):
    def setUp(self) -> None:
        self.packet = build_demo_packet()

    @staticmethod
    def codes(result: dict) -> set[str]:
        return {finding["code"] for finding in result["findings"]}

    def test_demo_packet_is_ready(self) -> None:
        result = evaluate_packet(self.packet)
        self.assertEqual("ready_for_architecture_review", result["status"])
        self.assertEqual([], result["findings"])

    def test_missing_section_blocks_packet(self) -> None:
        del self.packet["reliability"]
        result = evaluate_packet(self.packet)
        self.assertEqual("blocked", result["status"])
        self.assertIn("missing_section", self.codes(result))

    def test_dependency_cycle_is_detected(self) -> None:
        self.packet["orchestration"]["tasks"][0]["prerequisites"] = ["review"]
        result = evaluate_packet(self.packet)
        self.assertIn("dependency_cycle", self.codes(result))

    def test_unknown_prerequisite_is_detected(self) -> None:
        self.packet["orchestration"]["tasks"][1]["prerequisites"] = ["missing-task"]
        result = evaluate_packet(self.packet)
        self.assertIn("unknown_prerequisite", self.codes(result))

    def test_task_cannot_receive_undefined_tool(self) -> None:
        self.packet["orchestration"]["tasks"][0]["allowed_tools"] = ["delete_case"]
        result = evaluate_packet(self.packet)
        self.assertIn("undistributed_tool", self.codes(result))

    def test_write_tool_requires_authorization_and_idempotency(self) -> None:
        tool = self.packet["tools"][0]
        tool["side_effect"] = "write"
        result = evaluate_packet(self.packet)
        codes = self.codes(result)
        self.assertIn("write_without_authorization", codes)
        self.assertIn("write_without_idempotency", codes)

    def test_tool_error_contract_must_preserve_partial_state(self) -> None:
        self.packet["tools"][0]["error_contract"] = ["category", "retryable"]
        result = evaluate_packet(self.packet)
        self.assertIn("incomplete_error_contract", self.codes(result))

    def test_tool_requires_an_object_input_schema(self) -> None:
        del self.packet["tools"][0]["input_schema"]
        result = evaluate_packet(self.packet)
        self.assertIn("invalid_input_schema", self.codes(result))

    def test_tool_input_schema_must_be_closed(self) -> None:
        self.packet["tools"][0]["input_schema"]["additionalProperties"] = True
        result = evaluate_packet(self.packet)
        self.assertIn("open_input_schema", self.codes(result))

    def test_tool_schema_cannot_require_undeclared_property(self) -> None:
        self.packet["tools"][0]["input_schema"]["required"] = ["case_id", "tenant_id"]
        result = evaluate_packet(self.packet)
        self.assertIn("invalid_input_schema", self.codes(result))

    def test_ci_must_start_fresh_and_read_only(self) -> None:
        self.packet["claude_code"]["ci"]["fresh_checkout"] = False
        result = evaluate_packet(self.packet)
        self.assertIn("unsafe_ci", self.codes(result))

    def test_provenance_validation_layer_is_required(self) -> None:
        self.packet["structured_output"]["validation_layers"].remove("provenance")
        result = evaluate_packet(self.packet)
        self.assertIn("missing_validation_layer", self.codes(result))

    def test_provenance_metadata_requires_content_type(self) -> None:
        self.packet["reliability"]["provenance_fields"].remove("content_type")
        result = evaluate_packet(self.packet)
        self.assertIn("incomplete_provenance", self.codes(result))

    def test_human_review_includes_random_sample(self) -> None:
        self.packet["reliability"]["human_review"].remove("random_sample")
        result = evaluate_packet(self.packet)
        self.assertIn("incomplete_human_review", self.codes(result))

    def test_validation_does_not_mutate_packet(self) -> None:
        before = copy.deepcopy(self.packet)
        evaluate_packet(self.packet)
        self.assertEqual(before, self.packet)


if __name__ == "__main__":
    unittest.main()
