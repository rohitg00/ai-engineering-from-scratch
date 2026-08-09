import dataclasses
import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("architecture_gate", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ArchitectureGateTests(unittest.TestCase):
    def test_example_packet_is_ready(self):
        self.assertTrue(MODULE.release_decision(MODULE.example_packet())["ready"])

    def test_unknown_evaluation_operator_fails_fast(self):
        gate = MODULE.EvaluationGate("metric", 1, "!=", 0)
        with self.assertRaises(ValueError):
            gate.passes()

    def test_failed_quality_gate_blocks_release(self):
        packet = MODULE.example_packet()
        failed = dataclasses.replace(packet, evaluation_gates=(MODULE.EvaluationGate("quality", 0.5, ">=", 0.9),))
        decision = MODULE.release_decision(failed)
        self.assertFalse(decision["ready"])
        self.assertEqual(decision["blocking_count"], 1)

    def test_unverified_hard_control_blocks_release(self):
        packet = MODULE.example_packet()
        control = dataclasses.replace(packet.controls[0], verified=False)
        failed = dataclasses.replace(packet, controls=(control,))
        self.assertFalse(MODULE.release_decision(failed)["ready"])

    def test_empty_controls_block_release(self):
        packet = dataclasses.replace(MODULE.example_packet(), controls=())
        decision = MODULE.release_decision(packet)
        self.assertFalse(decision["ready"])
        self.assertTrue(any(finding["category"] == "governance" for finding in decision["findings"]))

    def test_empty_evaluation_gates_block_release(self):
        packet = dataclasses.replace(MODULE.example_packet(), evaluation_gates=())
        decision = MODULE.release_decision(packet)
        self.assertFalse(decision["ready"])
        self.assertTrue(any(finding["category"] == "evaluation" for finding in decision["findings"]))

    def test_unverified_non_hard_control_does_not_block_by_itself(self):
        packet = MODULE.example_packet()
        control = dataclasses.replace(packet.controls[0], verified=False, hard_gate=False)
        candidate = dataclasses.replace(packet, controls=(control,))
        self.assertTrue(MODULE.release_decision(candidate)["ready"])

    def test_unmeasurable_requirement_blocks_release(self):
        packet = MODULE.example_packet()
        requirement = dataclasses.replace(packet.requirements[0], measurable=False)
        failed = dataclasses.replace(packet, requirements=(requirement,))
        self.assertFalse(MODULE.release_decision(failed)["ready"])

    def test_missing_reversal_condition_blocks_release(self):
        packet = MODULE.example_packet()
        decision = dataclasses.replace(packet.decisions[0], reversal_condition="")
        failed = dataclasses.replace(packet, decisions=(decision,))
        self.assertFalse(MODULE.release_decision(failed)["ready"])

    def test_missing_non_goals_is_non_blocking_finding(self):
        packet = dataclasses.replace(MODULE.example_packet(), non_goals=())
        decision = MODULE.release_decision(packet)
        self.assertTrue(decision["ready"])
        self.assertTrue(any(finding["category"] == "scope" for finding in decision["findings"]))

    def test_missing_operating_owner_blocks_release(self):
        packet = dataclasses.replace(MODULE.example_packet(), operating_owner="")
        self.assertFalse(MODULE.release_decision(packet)["ready"])


if __name__ == "__main__":
    unittest.main()
