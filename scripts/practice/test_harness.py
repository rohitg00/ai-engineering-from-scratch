import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "practice" / "_harness"))

import practice_check

TESTS = '''
from practice_check import check, report, true


@check("examples", "train", "The loss is reported.")
def train(sub):
    sub.train()
    true(True, "")
'''


class HarnessTest(unittest.TestCase):
    def run_source(self, source):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "practice_tests.py"
            path.write_text(TESTS)
            return json.loads(practice_check.evaluate_json(source, str(path), "", "", 5))

    def test_a_diverging_loss_still_gives_a_report(self):
        report = self.run_source("from practice_check import report\n\n\ndef train():\n    report(0, 1.0)\n    report(1, float('nan'))\n    report(2, float('inf'))\n")
        self.assertEqual(report["curve"], [[0, 1.0, "loss"], [1, None, "loss"], [2, None, "loss"]])
        self.assertTrue(report["summary"]["ok"])

    def test_system_exit_in_learner_code_is_an_error(self):
        report = self.run_source("import sys\n\n\ndef train():\n    sys.exit(0)\n")
        self.assertEqual(report["results"][0]["status"], "error")
        self.assertFalse(report["summary"]["ok"])

    def test_a_support_module_does_not_leak_between_problems(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            for folder, value in ((first, 1), (second, 2)):
                Path(folder, "support.py").write_text(f"VALUE = {value}\n")
                Path(folder, "practice_tests.py").write_text("from practice_check import check, equal\nfrom support import VALUE\n\n\n@check(\"examples\", \"value\", \"The value.\")\ndef value(sub):\n    equal(sub.VALUE, VALUE)\n")
            for folder, value in ((first, 1), (second, 2)):
                report = practice_check.evaluate(f"VALUE = {value}\n", str(Path(folder, "practice_tests.py")), {})
                self.assertTrue(report["summary"]["ok"], report)


if __name__ == "__main__":
    unittest.main()
