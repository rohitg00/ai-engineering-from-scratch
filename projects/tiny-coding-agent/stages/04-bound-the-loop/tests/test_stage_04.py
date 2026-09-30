import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Loop(unittest.TestCase):
    def test_unknown(self):
        self.assertEqual(agent_loop(".", [{"tool": "shell"}])["state"], "failed")

    def test_empty(self):
        self.assertEqual(agent_loop(".", [])["state"], "failed")

    def test_budget(self):
        with tempfile.TemporaryDirectory() as p:
            self.assertEqual(
                agent_loop(p, [{"tool": "test"}] * 3, 1)["state"], "budget_exhausted"
            )

    def test_invalid(self):
        with self.assertRaises(ValueError):
            agent_loop(".", [], 0)

    def test_skip_cannot_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            (p / "tests").mkdir()
            (p / "tests" / "test_skip.py").write_text(
                "import unittest\nclass T(unittest.TestCase):\n"
                " @unittest.skip('dependency unavailable')\n"
                " def test_missing(self): self.fail()\n"
            )
            result = agent_loop(p, [{"tool": "test"}])
            self.assertEqual(result["state"], "failed")

    def test_real_repair(self):
        with tempfile.TemporaryDirectory() as f:
            p = Path(f)
            (p / "tests").mkdir()
            (p / "calc.py").write_text("def add(a,b):return a-b")
            (p / "tests" / "test_x.py").write_text(
                "import unittest\nfrom calc import add\nclass T(unittest.TestCase):\n def test_x(self):self.assertEqual(add(2,3),5)\n".replace(
                    "\n", "\n"
                )
            )
            result = agent_loop(
                p,
                [
                    {"tool": "test"},
                    {"tool": "patch", "path": "calc.py", "old": "a-b", "new": "a+b"},
                    {"tool": "test"},
                ],
            )
            self.assertEqual(result["state"], "completed")
