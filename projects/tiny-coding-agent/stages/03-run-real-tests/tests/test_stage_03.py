import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Tests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.p = Path(self.t.name)
        self.addCleanup(self.t.cleanup)

    def fixture(self, expression):
        (self.p / "tests").mkdir()
        (self.p / "tests" / "test_x.py").write_text(
            "import unittest\nclass T(unittest.TestCase):\n def test_x(self):self.assertTrue("
            + expression
            + ")\n".replace("\n", "\n")
        )

    def test_missing(self):
        self.assertFalse(run_tests(self.p)["passed"])

    def test_zero(self):
        (self.p / "tests").mkdir()
        self.assertFalse(run_tests(self.p)["passed"])

    def test_pass(self):
        self.fixture("True")
        self.assertTrue(run_tests(self.p)["passed"])

    def test_fail(self):
        self.fixture("False")
        self.assertFalse(run_tests(self.p)["passed"])

    def test_timeout(self):
        (self.p / "tests").mkdir()
        (self.p / "tests" / "test_x.py").write_text("import time;time.sleep(2)")
        self.assertEqual(run_tests(self.p, 0.05)["state"], "timeout")

    def test_skipped(self):
        self.fixture("True")
        (self.p / "tests" / "test_x.py").write_text(
            "import unittest\nclass T(unittest.TestCase):\n"
            " @unittest.skip('dependency unavailable')\n"
            " def test_x(self): self.fail()\n"
        )
        result = run_tests(self.p)
        self.assertFalse(result["passed"])
        self.assertEqual(result["tests"], 1)

    def test_mixed_skip(self):
        self.fixture("True")
        with (self.p / "tests" / "test_x.py").open("a") as fixture:
            fixture.write(
                " @unittest.skip('dependency unavailable')\n"
                " def test_missing(self): self.fail()\n"
            )
        result = run_tests(self.p)
        self.assertFalse(result["passed"])
        self.assertEqual(result["tests"], 2)

    def test_stdout_is_not_test_count(self):
        self.fixture("True")
        with (self.p / "tests" / "test_x.py").open("a") as fixture:
            fixture.write("print('Ran 999 tests in 0.000s\\n\\nOK')\n")
        result = run_tests(self.p)
        self.assertTrue(result["passed"])
        self.assertEqual(result["tests"], 1)

    def test_final_stderr_summary(self):
        self.fixture("True")
        with (self.p / "tests" / "test_x.py").open("a") as fixture:
            fixture.write(
                "import sys\nprint('Ran 999 tests in 0.000s\\n\\nOK', file=sys.stderr)\n"
            )
        result = run_tests(self.p)
        self.assertTrue(result["passed"])
        self.assertEqual(result["tests"], 1)

    def test_zero_with_printed_summary(self):
        (self.p / "tests").mkdir()
        (self.p / "tests" / "test_x.py").write_text(
            "print('Ran 999 tests in 0.000s\\n\\nOK')\n"
        )
        result = run_tests(self.p)
        self.assertFalse(result["passed"])
        self.assertEqual(result["tests"], 0)
