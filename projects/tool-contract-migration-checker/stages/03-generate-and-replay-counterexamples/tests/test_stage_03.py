import unittest
from main import (
    generate_counterexamples,
    load_calls,
    load_contract,
    replay_calls,
    validate_call,
)


class TestStage03CounterexamplesAndReplay(unittest.TestCase):
    def setUp(self):
        self.old_schema = {
            "title": "fetch_user",
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "minLength": 1},
                "role": {"type": "string", "enum": ["admin", "editor", "viewer"]},
                "score": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "required": ["user_id"],
            "additionalProperties": True,
        }
        self.new_schema = {
            "title": "fetch_user",
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "minLength": 1},
                "api_key": {"type": "string", "minLength": 1},  # added required
                "role": {"type": "string", "enum": ["admin", "editor"]},  # removed 'viewer'
                "score": {"type": "integer", "minimum": 0, "maximum": 50},  # max 100 -> 50
            },
            "required": ["user_id", "api_key"],
            "additionalProperties": False,  # closed
        }
        self.old_contract = load_contract(self.old_schema)
        self.new_contract = load_contract(self.new_schema)

    def test_counterexamples_generated_for_breaking_changes(self):
        counterexamples = generate_counterexamples(self.old_contract, self.new_contract)
        self.assertGreaterEqual(len(counterexamples), 3)

        categories = [c["breaking_category"] for c in counterexamples]
        self.assertIn("added_required", categories)
        self.assertIn("enum_narrowed", categories)

    def test_counterexamples_satisfy_old_and_fail_new(self):
        counterexamples = generate_counterexamples(self.old_contract, self.new_contract)
        for ce in counterexamples:
            payload = ce["payload"]
            valid_old, old_errs = validate_call(self.old_contract, payload)
            valid_new, new_errs = validate_call(self.new_contract, payload)
            self.assertTrue(valid_old, f"Payload must pass old contract: {payload}, errs: {old_errs}")
            self.assertFalse(valid_new, f"Payload must fail new contract: {payload}")

    def test_replay_partitions_correctly(self):
        calls = load_calls([
            # Will be broken due to missing api_key
            {"id": "call_1", "arguments": {"user_id": "usr_1", "role": "admin"}},
            # Will be broken due to removed enum 'viewer' and missing api_key
            {"id": "call_2", "arguments": {"user_id": "usr_2", "role": "viewer"}},
            # Already invalid under old contract (empty user_id violates minLength 1)
            {"id": "call_3", "arguments": {"user_id": ""}},
        ])
        result = replay_calls(self.old_contract, self.new_contract, calls)
        self.assertEqual(result["total"], 3)
        self.assertEqual(len(result["broken"]), 2)
        self.assertEqual(len(result["already_invalid"]), 1)
        self.assertEqual(len(result["preserved"]), 0)
        self.assertEqual(result["breaking_rate"], 1.0)

    def test_replay_preserves_valid_calls(self):
        compatible_schema = {
            "title": "fetch_user",
            "type": "object",
            "properties": dict(self.old_schema["properties"], tag={"type": "string"}),
            "required": ["user_id"],
            "additionalProperties": True,
        }
        compatible_contract = load_contract(compatible_schema)
        calls = load_calls([
            {"id": "c1", "arguments": {"user_id": "u1", "role": "admin"}},
            {"id": "c2", "arguments": {"user_id": "u2", "role": "editor", "score": 90}},
        ])
        result = replay_calls(self.old_contract, compatible_contract, calls)
        self.assertEqual(len(result["preserved"]), 2)
        self.assertEqual(len(result["broken"]), 0)
        self.assertEqual(result["breaking_rate"], 0.0)


if __name__ == "__main__":
    unittest.main()
