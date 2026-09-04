"""Tests for lesson 03 prompt contracts."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import load_packet, score_packet, validate_packet


class PromptContractTests(unittest.TestCase):
    def setUp(self):
        self.packet = load_packet(LESSON / "outputs" / "prompt-contract-packet.json")

    def test_filled_packet_is_valid(self):
        self.assertEqual(validate_packet(self.packet), [])

    def test_all_contract_fields_are_required(self):
        broken = copy.deepcopy(self.packet)
        del broken["contract"]["evidence"]
        self.assertIn("seven", " ".join(validate_packet(broken)))

    def test_acceptance_checks_must_be_observable(self):
        broken = copy.deepcopy(self.packet)
        broken["contract"]["acceptanceChecks"] = ["good"]
        self.assertIn("observable", " ".join(validate_packet(broken)))

    def test_source_ranks_must_be_consecutive(self):
        broken = copy.deepcopy(self.packet)
        broken["sourceHierarchy"][1]["rank"] = 9
        self.assertIn("consecutive", " ".join(validate_packet(broken)))

    def test_every_stage_needs_a_gate(self):
        broken = copy.deepcopy(self.packet)
        broken["stages"][0]["gate"] = ""
        self.assertIn("gate", " ".join(validate_packet(broken)))

    def test_adversarial_case_types_are_required(self):
        broken = copy.deepcopy(self.packet)
        broken["evaluationCases"] = broken["evaluationCases"][:-1]
        self.assertIn("unauthorized", " ".join(validate_packet(broken)))

    def test_score_exposes_coverage(self):
        score = score_packet(self.packet)
        self.assertTrue(score["passed"])
        self.assertEqual(score["contractFields"], 7)
        self.assertEqual(score["stageCount"], 5)


if __name__ == "__main__":
    unittest.main()
