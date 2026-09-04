"""Tests for lesson 06 governance controls."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import load_packet, review_required, score_control_map, validate_control_map


class ResponsibleUseTests(unittest.TestCase):
    def setUp(self):
        self.packet = load_packet(LESSON / "outputs" / "responsible-use-control-map.json")

    def test_filled_control_map_is_valid(self):
        self.assertEqual(validate_control_map(self.packet), [])

    def test_high_consequence_requires_human_gate(self):
        broken = copy.deepcopy(self.packet)
        broken["approvalPacket"]["humanGate"] = False
        self.assertIn("humanGate", " ".join(validate_control_map(broken)))

    def test_every_risk_needs_three_control_layers(self):
        broken = copy.deepcopy(self.packet)
        broken["risks"][0]["detect"] = ""
        self.assertIn("prevent, detect, and correct", " ".join(validate_control_map(broken)))

    def test_untrusted_content_cannot_authorize(self):
        broken = copy.deepcopy(self.packet)
        broken["approvalPacket"]["untrustedContentCanAuthorize"] = True
        self.assertIn("cannot authorize", " ".join(validate_control_map(broken)))

    def test_confidence_does_not_remove_review(self):
        broken = copy.deepcopy(self.packet)
        broken["analysisConfidence"] = 1.0
        self.assertTrue(score_control_map(broken)["reviewRequired"])

    def test_irreversible_low_consequence_still_requires_review(self):
        self.assertTrue(review_required("low", False))
        self.assertFalse(review_required("low", True))

    def test_unknown_risk_class_fails_closed(self):
        with self.assertRaises(ValueError):
            review_required("unknown", True)


if __name__ == "__main__":
    unittest.main()
