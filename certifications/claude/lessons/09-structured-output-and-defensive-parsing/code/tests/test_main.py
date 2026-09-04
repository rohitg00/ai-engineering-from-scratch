"""Tests for lesson 09 schema validation and repair."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import BoundedExtractor, ContractError, TRIAGE_SCHEMA, demo, parse_and_validate


VALID = '{"category":"billing","priority":2,"summary":"Duplicate charge","needs_human":false}'


class ContractTests(unittest.TestCase):
    def test_shipped_artifact_matches_repaired_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "validated-triage.json"
        self.assertEqual(json.loads(artifact.read_text(encoding="utf-8")), demo())

    def test_valid_object_is_returned(self):
        self.assertEqual(parse_and_validate(VALID, TRIAGE_SCHEMA)["priority"], 2)

    def test_markdown_fence_is_not_silently_stripped(self):
        with self.assertRaises(ContractError):
            parse_and_validate(f"```json\n{VALID}\n```", TRIAGE_SCHEMA)

    def test_missing_required_field_reports_path(self):
        with self.assertRaises(ContractError) as caught:
            parse_and_validate('{"category":"bug","priority":3,"summary":"x"}', TRIAGE_SCHEMA)
        self.assertIn("$.needs_human", str(caught.exception))

    def test_boolean_is_not_accepted_as_integer(self):
        with self.assertRaisesRegex(ContractError, "expected integer"):
            parse_and_validate('{"category":"bug","priority":true,"summary":"x","needs_human":false}', TRIAGE_SCHEMA)

    def test_additional_field_is_rejected(self):
        with self.assertRaisesRegex(ContractError, "unexpected field"):
            parse_and_validate('{"category":"bug","priority":3,"summary":"x","needs_human":false,"debug":"secret"}', TRIAGE_SCHEMA)

    def test_bounded_extractor_repairs_once(self):
        prompts = []
        responses = iter(['{"category":"bug"}', VALID])
        extractor = BoundedExtractor(lambda prompt: prompts.append(prompt) or next(responses), TRIAGE_SCHEMA, max_attempts=2)
        self.assertEqual(extractor.extract("triage")["category"], "billing")
        self.assertIn("Validation errors", prompts[1])

    def test_bounded_extractor_stops_after_budget(self):
        calls = []
        extractor = BoundedExtractor(lambda prompt: calls.append(prompt) or "{}", TRIAGE_SCHEMA, max_attempts=2)
        with self.assertRaises(ContractError):
            extractor.extract("triage")
        self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
