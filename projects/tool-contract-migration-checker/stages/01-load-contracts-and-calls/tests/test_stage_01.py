import unittest
from main import load_calls, load_contract, validate_call


class TestStage01LoadAndValidate(unittest.TestCase):
    """Unit tests for Stage 1 contract and call loading and validation."""

    def setUp(self):
        """Set up standard fixture schema for test cases."""
        self.valid_schema = {
            "title": "fetch_weather",
            "type": "object",
            "properties": {
                "city": {"type": "string", "minLength": 2},
                "days": {"type": "integer", "minimum": 1, "maximum": 14},
                "units": {"type": "string", "enum": ["metric", "imperial"]},
            },
            "required": ["city"],
            "additionalProperties": False,
        }

    def test_load_contract_valid(self):
        """Verify loading and normalising a valid contract schema."""
        contract = load_contract(self.valid_schema)
        self.assertEqual(contract["title"], "fetch_weather")
        self.assertEqual(contract["type"], "object")
        self.assertEqual(contract["required"], ["city"])
        self.assertFalse(contract["additionalProperties"])
        self.assertIn("city", contract["properties"])

    def test_load_contract_malformed(self):
        """Verify rejection of malformed schemas and property structures."""
        with self.assertRaises(ValueError):
            load_contract("not_a_dict")
        with self.assertRaises(ValueError):
            load_contract({"type": "array"})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "properties": "not_a_dict"})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "properties": {"city": True}})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "required": [123]})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "properties": {"days": {"maximum": "10"}}})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "properties": {"days": {"minimum": float("nan")}}})

    def test_load_contract_array_type_and_nullable_property(self):
        """Verify array types and nullable properties in contract schema."""
        schema = {
            "title": "nullable_tool",
            "type": ["object"],
            "properties": {
                "name": {"type": ["string", "null"]},
            },
        }
        c = load_contract(schema)
        self.assertEqual(c["type"], "object")
        ok_str, _ = validate_call(c, {"name": "alice"})
        self.assertTrue(ok_str)
        ok_null, _ = validate_call(c, {"name": None})
        self.assertTrue(ok_null)
        ok_bad, issues = validate_call(c, {"name": 123})
        self.assertFalse(ok_bad)

    def test_load_calls_valid(self):
        """Verify parsing valid recorded tool invocations."""
        raw_calls = [
            {"id": "call_1", "arguments": {"city": "Tokyo", "days": 5}},
            {"id": "call_2", "arguments": {"city": "Paris", "units": "metric"}},
        ]
        calls = load_calls(raw_calls)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["id"], "call_1")
        self.assertEqual(calls[0]["arguments"]["city"], "Tokyo")

    def test_load_calls_malformed(self):
        """Verify rejection of malformed historical call logs."""
        with self.assertRaises(ValueError):
            load_calls("not_a_list")
        with self.assertRaises(ValueError):
            load_calls([{"no_arguments_key": {}}])
        with self.assertRaises(ValueError):
            load_calls([{"arguments": "not_a_dict"}])
        with self.assertRaises(ValueError):
            load_calls([{"arguments": {"val": float("nan")}}])
        with self.assertRaises(ValueError):
            load_calls([{"arguments": {"val": float("inf")}}])

    def test_validate_call_success(self):
        """Verify successful validation against compliant arguments."""
        contract = load_contract(self.valid_schema)
        ok, issues = validate_call(contract, {"city": "Berlin", "days": 3, "units": "metric"})
        self.assertTrue(ok)
        self.assertEqual(issues, [])
        # JSON Schema integer accepts 3.0
        ok_float_int, _ = validate_call(contract, {"city": "Berlin", "days": 3.0})
        self.assertTrue(ok_float_int)

    def test_validate_call_missing_required(self):
        """Verify validation failure when required arguments are missing."""
        contract = load_contract(self.valid_schema)
        ok, issues = validate_call(contract, {"days": 3})
        self.assertFalse(ok)
        self.assertTrue(any("missing required property" in issue for issue in issues))

    def test_validate_call_constraints_and_bounds(self):
        """Verify enforcement of string lengths, numeric ranges, and enums."""
        contract = load_contract(self.valid_schema)
        # city too short (minLength 2)
        ok, issues = validate_call(contract, {"city": "A"})
        self.assertFalse(ok)
        # days > maximum 14
        ok, issues = validate_call(contract, {"city": "Rome", "days": 20})
        self.assertFalse(ok)
        self.assertTrue(any("greater than maximum" in issue for issue in issues))
        # unexpected property with additionalProperties: False
        ok, issues = validate_call(contract, {"city": "Rome", "unknown_key": "val"})
        self.assertFalse(ok)
        self.assertTrue(any("unexpected property" in issue for issue in issues))
        # enum mismatch
        ok, issues = validate_call(contract, {"city": "Rome", "units": "kelvin"})
        self.assertFalse(ok)
        self.assertTrue(any("not in enum" in issue for issue in issues))
        # null value checked against enum
        ok_null_enum, issues_null = validate_call(contract, {"city": "Rome", "units": None})
        self.assertFalse(ok_null_enum)
        self.assertTrue(any("not in enum" in i or "cannot be null" in i for i in issues_null))


if __name__ == "__main__":
    unittest.main()
