import unittest
from main import load_calls, load_contract, validate_call


class TestStage01LoadAndValidate(unittest.TestCase):
    def setUp(self):
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
        contract = load_contract(self.valid_schema)
        self.assertEqual(contract["title"], "fetch_weather")
        self.assertEqual(contract["type"], "object")
        self.assertEqual(contract["required"], ["city"])
        self.assertFalse(contract["additionalProperties"])
        self.assertIn("city", contract["properties"])

    def test_load_contract_malformed(self):
        with self.assertRaises(ValueError):
            load_contract("not_a_dict")
        with self.assertRaises(ValueError):
            load_contract({"type": "array"})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "properties": "not_a_dict"})
        with self.assertRaises(ValueError):
            load_contract({"type": "object", "required": [123]})

    def test_load_calls_valid(self):
        raw_calls = [
            {"id": "call_1", "arguments": {"city": "Tokyo", "days": 5}},
            {"id": "call_2", "arguments": {"city": "Paris", "units": "metric"}},
        ]
        calls = load_calls(raw_calls)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["id"], "call_1")
        self.assertEqual(calls[0]["arguments"]["city"], "Tokyo")

    def test_load_calls_malformed(self):
        with self.assertRaises(ValueError):
            load_calls("not_a_list")
        with self.assertRaises(ValueError):
            load_calls([{"no_arguments_key": {}}])
        with self.assertRaises(ValueError):
            load_calls([{"arguments": "not_a_dict"}])

    def test_validate_call_success(self):
        contract = load_contract(self.valid_schema)
        ok, issues = validate_call(contract, {"city": "Berlin", "days": 3, "units": "metric"})
        self.assertTrue(ok)
        self.assertEqual(issues, [])

    def test_validate_call_missing_required(self):
        contract = load_contract(self.valid_schema)
        ok, issues = validate_call(contract, {"days": 3})
        self.assertFalse(ok)
        self.assertTrue(any("missing required property" in issue for issue in issues))

    def test_validate_call_constraints_and_bounds(self):
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


if __name__ == "__main__":
    unittest.main()
