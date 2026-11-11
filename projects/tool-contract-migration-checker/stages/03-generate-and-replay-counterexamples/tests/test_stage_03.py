import unittest
from main import (
    generate_counterexamples,
    load_calls,
    load_contract,
    replay_calls,
    validate_call,
)


class TestStage03CounterexamplesAndReplay(unittest.TestCase):
    """Unit tests for Stage 3 counterexample generation and call replay."""

    def setUp(self):
        """Set up test schema contracts for breaking change scenarios."""
        self.old_schema = {
            "title": "fetch_user",
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "minLength": 1},
                "role": {"type": "string", "enum": ["admin", "editor", "viewer"]},
                "score": {"type": "integer", "minimum": 0, "maximum": 100},
                "tags": {"type": "array", "minItems": 1, "maxItems": 10},
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
                "tags": {"type": "array", "minItems": 2, "maxItems": 5},  # bounds narrowed
            },
            "required": ["user_id", "api_key"],
            "additionalProperties": False,  # closed
        }
        self.old_contract = load_contract(self.old_schema)
        self.new_contract = load_contract(self.new_schema)

    def test_counterexamples_generated_for_breaking_changes(self):
        """Verify counterexamples are generated for detected breaking changes."""
        counterexamples = generate_counterexamples(self.old_contract, self.new_contract)
        self.assertGreaterEqual(len(counterexamples), 3)

        categories = [c["breaking_category"] for c in counterexamples]
        self.assertIn("added_required", categories)
        self.assertIn("enum_narrowed", categories)

    def test_counterexamples_satisfy_old_and_fail_new(self):
        """Verify each counterexample payload passes old schema and fails new schema."""
        counterexamples = generate_counterexamples(self.old_contract, self.new_contract)
        for ce in counterexamples:
            payload = ce["payload"]
            valid_old, old_errs = validate_call(self.old_contract, payload)
            valid_new, new_errs = validate_call(self.new_contract, payload)
            self.assertTrue(valid_old, f"Payload must pass old contract: {payload}, errs: {old_errs}")
            self.assertFalse(valid_new, f"Payload must fail new contract: {payload}")

    def test_counterexamples_for_tightened_bounds_and_strings(self):
        """Verify counterexamples for string and integer boundary tightenings."""
        old_s = {
            "title": "t",
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 2, "maxLength": 50},
                "count": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "required": ["name", "count"],
        }
        new_s = {
            "title": "t",
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 5, "maxLength": 20},
                "count": {"type": "integer", "minimum": 10, "maximum": 50},
            },
            "required": ["name", "count"],
        }
        ces = generate_counterexamples(load_contract(old_s), load_contract(new_s))
        self.assertGreaterEqual(len(ces), 2)
        for ce in ces:
            valid_old, _ = validate_call(load_contract(old_s), ce["payload"])
            valid_new, _ = validate_call(load_contract(new_s), ce["payload"])
            self.assertTrue(valid_old)
            self.assertFalse(valid_new)

    def test_counterexamples_for_array_bounds(self):
        """Verify counterexamples for array item count boundary tightenings."""
        old_s = {
            "title": "arr",
            "type": "object",
            "properties": {"items": {"type": "array", "minItems": 0, "maxItems": 10}},
            "required": ["items"],
        }
        new_s = {
            "title": "arr",
            "type": "object",
            "properties": {"items": {"type": "array", "minItems": 2, "maxItems": 5}},
            "required": ["items"],
        }
        ces = generate_counterexamples(load_contract(old_s), load_contract(new_s))
        self.assertGreaterEqual(len(ces), 1)
        for ce in ces:
            valid_old, _ = validate_call(load_contract(old_s), ce["payload"])
            valid_new, _ = validate_call(load_contract(new_s), ce["payload"])
            self.assertTrue(valid_old)
            self.assertFalse(valid_new)

    def test_counterexamples_for_narrowed_type(self):
        """Verify counterexamples synthesized when parameter types are narrowed."""
        old_s = {
            "title": "typed",
            "type": "object",
            "properties": {"weight": {"type": "number"}},
            "required": ["weight"],
        }
        new_s = {
            "title": "typed",
            "type": "object",
            "properties": {"weight": {"type": "integer"}},
            "required": ["weight"],
        }
        ces = generate_counterexamples(load_contract(old_s), load_contract(new_s))
        self.assertEqual(len(ces), 1)
        self.assertEqual(ces[0]["breaking_category"], "type_narrowed")
        self.assertEqual(ces[0]["payload"]["weight"], 1.5)

    def test_counterexamples_for_untyped_and_removed_properties(self):
        """Verify counterexamples for untyped to typed narrowing and closed removed properties."""
        # 1. Untyped to string
        old_untyped = {"title": "t", "type": "object", "properties": {"val": {}}}
        new_typed = {"title": "t", "type": "object", "properties": {"val": {"type": "string"}}}
        ces1 = generate_counterexamples(load_contract(old_untyped), load_contract(new_typed))
        self.assertGreaterEqual(len(ces1), 1)
        valid_old1, _ = validate_call(load_contract(old_untyped), ces1[0]["payload"])
        valid_new1, _ = validate_call(load_contract(new_typed), ces1[0]["payload"])
        self.assertTrue(valid_old1)
        self.assertFalse(valid_new1)

        # 2. Removed property in closed schema
        old_closed = {"title": "t", "type": "object", "properties": {"foo": {"type": "string"}}, "additionalProperties": False}
        new_closed = {"title": "t", "type": "object", "properties": {}, "additionalProperties": False}
        ces2 = generate_counterexamples(load_contract(old_closed), load_contract(new_closed))
        self.assertGreaterEqual(len(ces2), 1)
        self.assertEqual(ces2[0]["breaking_category"], "removed_property")
        valid_old2, _ = validate_call(load_contract(old_closed), ces2[0]["payload"])
        valid_new2, _ = validate_call(load_contract(new_closed), ces2[0]["payload"])
        self.assertTrue(valid_old2)
        self.assertFalse(valid_new2)

    def test_replay_partitions_correctly(self):
        """Verify replay partitioning into preserved, broken, and already invalid calls."""
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
        """Verify replay correctly preserves calls that remain valid under new schema."""
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

    def test_replay_enforces_array_item_bounds(self):
        """Verify replay detects calls that violate array item length boundaries."""
        calls = load_calls([
            {"id": "c_arr_ok", "arguments": {"user_id": "u1", "tags": ["a", "b", "c"]}},
            {"id": "c_arr_too_long", "arguments": {"user_id": "u1", "tags": ["1", "2", "3", "4", "5", "6"]}},
        ])
        schema_with_api_key = dict(self.new_schema)
        schema_with_api_key["required"] = ["user_id"]
        result = replay_calls(self.old_contract, load_contract(schema_with_api_key), calls)
        broken_ids = [b["id"] for b in result["broken"]]
        self.assertIn("c_arr_too_long", broken_ids)

    def test_null_removed_from_types_has_counterexample(self):
        """Verify removing null from a property's types yields a null counterexample."""
        old_c = load_contract({"type": "object", "properties": {"note": {"type": ["string", "null"]}}})
        new_c = load_contract({"type": "object", "properties": {"note": {"type": "string"}}})
        cx = [c for c in generate_counterexamples(old_c, new_c) if c["breaking_category"] == "type_narrowed"]
        self.assertEqual(len(cx), 1)
        self.assertIsNone(cx[0]["payload"]["note"])

    def test_untyped_property_excluding_null_has_counterexample(self):
        """Verify typing an untyped property with every type except null yields a null counterexample."""
        all_but_null = ["string", "integer", "number", "boolean", "array", "object"]
        old_c = load_contract({"type": "object", "properties": {"v": {}}})
        new_c = load_contract({"type": "object", "properties": {"v": {"type": all_but_null}}})
        cx = [c for c in generate_counterexamples(old_c, new_c) if c["breaking_category"] == "type_narrowed"]
        self.assertEqual(len(cx), 1)
        self.assertIsNone(cx[0]["payload"]["v"])

    def test_removed_string_type_respects_old_min_length(self):
        """Verify a removed string type gets a counterexample long enough for the old minLength."""
        others = ["number", "integer", "boolean", "array", "object", "null"]
        old_c = load_contract({"type": "object", "properties": {"code": {"minLength": 8}}})
        new_c = load_contract({"type": "object", "properties": {"code": {"type": others, "minLength": 8}}})
        cx = [c for c in generate_counterexamples(old_c, new_c) if c["breaking_category"] == "type_narrowed"]
        self.assertEqual(len(cx), 1)
        self.assertIsInstance(cx[0]["payload"]["code"], str)
        self.assertGreaterEqual(len(cx[0]["payload"]["code"]), 8)

    def test_removed_enum_property_uses_old_schema_value(self):
        """Verify a removed enum property gets a counterexample built from its old allowed values."""
        old_c = load_contract({
            "type": "object",
            "properties": {"q": {"type": "string"}, "mode": {"type": "string", "enum": ["fast", "slow"]}},
        })
        new_c = load_contract({"type": "object", "properties": {"q": {"type": "string"}}, "additionalProperties": False})
        cx = [c for c in generate_counterexamples(old_c, new_c) if c["breaking_category"] == "removed_property"]
        self.assertEqual(len(cx), 1)
        self.assertEqual(cx[0]["payload"], {"mode": "fast"})

    def test_null_only_required_field_keeps_counterexamples(self):
        """Verify a required null-only field gets a null baseline so other counterexamples survive."""
        old_c = load_contract({
            "type": "object",
            "properties": {"cursor": {"type": "null"}, "mode": {"type": "string", "enum": ["a", "b"]}},
            "required": ["cursor"],
        })
        new_c = load_contract({
            "type": "object",
            "properties": {"cursor": {"type": "null"}, "mode": {"type": "string", "enum": ["a"]}},
            "required": ["cursor"],
        })
        cx = [c for c in generate_counterexamples(old_c, new_c) if c["breaking_category"] == "enum_narrowed"]
        self.assertEqual(len(cx), 1)
        self.assertEqual(cx[0]["payload"], {"cursor": None, "mode": "b"})


if __name__ == "__main__":
    unittest.main()
