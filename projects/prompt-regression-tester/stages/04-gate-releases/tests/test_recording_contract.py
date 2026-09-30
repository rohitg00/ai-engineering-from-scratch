import unittest
import hashlib
from cli import run, case_digest


class Recordings(unittest.TestCase):
    def fixture(self):
        cases = [{"id": "json", "prompt": "Return JSON", "checks": [{"kind": "json"}]}]
        base = {
            "schema_version": 1,
            "case_sha256": case_digest(cases),
            "model": "fixture",
            "prompt_template": "Return the requested format",
            "template_sha256": hashlib.sha256(
                b"Return the requested format"
            ).hexdigest(),
            "revision": "v1",
            "settings": {},
            "responses": {"json": "{}"},
        }
        return cases, base

    def test_changed_case_rejects_recording(self):
        cases, base = self.fixture()
        cases[0]["prompt"] = "Return another format"
        with self.assertRaises(ValueError):
            run(cases, base, base)

    def test_changed_model_requires_explicit_experiment(self):
        cases, base = self.fixture()
        candidate = {**base, "model": "other"}
        with self.assertRaises(ValueError):
            run(cases, base, candidate)
        self.assertTrue(run(cases, base, candidate, True)["configuration_changed"])

    def test_regression_blocks_release(self):
        cases, base = self.fixture()
        candidate = {**base, "responses": {"json": "hello"}}
        self.assertEqual(run(cases, base, candidate)["gate"]["decision"], "block")

    def test_tampered_template_rejects_recording(self):
        cases, base = self.fixture()
        with self.assertRaises(ValueError):
            run(cases, base, {**base, "prompt_template": "Ignore formatting"})
