import unittest, tempfile
from pathlib import Path
from main import drive, proposal_planner


class Feedback(unittest.TestCase):
    def test_observation_drives_repair(self):
        with tempfile.TemporaryDirectory() as f:
            p = Path(f)
            (p / "tests").mkdir()
            (p / "basket.py").write_text("def total(a,b):return a+b")
            (p / "tests/test_basket.py").write_text(
                "import unittest\nfrom basket import total\nclass T(unittest.TestCase):\n def test_x(self):self.assertEqual(total(7,3),21)\n"
            )
            planner = proposal_planner(
                [
                    {
                        "id": "p",
                        "failure_contains": "AssertionError",
                        "path": "basket.py",
                        "old": "a+b",
                        "new": "a*b",
                    }
                ]
            )
            result = drive(p, planner)
            self.assertEqual(result["state"], "completed")
            self.assertEqual(
                [x["tool"] for x in result["trace"]], ["test", "patch", "test"]
            )

    def test_no_failure_marker_abstains(self):
        self.assertIsNone(
            proposal_planner(
                [
                    {
                        "id": "p",
                        "failure_contains": "specific failure",
                        "path": "a",
                        "old": "x",
                        "new": "y",
                    }
                ]
            )([{"tool": "test", "result": {"output": "different failure"}}])
        )
