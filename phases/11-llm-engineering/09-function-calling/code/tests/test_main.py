import unittest
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from function_calling import run_code, calculator, read_file


class RunCodeGuardTests(unittest.TestCase):
    def test_benign_code_runs(self):
        out = run_code("result = sum(range(1, 101))")
        self.assertTrue(out.get("success"))
        self.assertEqual(out["result"], 5050)

    def test_math_helper_available(self):
        out = run_code("result = round(math.sqrt(2), 3)")
        self.assertTrue(out.get("success"))
        self.assertEqual(out["result"], 1.414)

    def test_import_statement_blocked(self):
        out = run_code("import os\nresult = os.getpid()")
        self.assertEqual(out.get("code"), "SECURITY_VIOLATION")

    def test_from_import_blocked(self):
        out = run_code("from os import getpid\nresult = getpid()")
        self.assertEqual(out.get("code"), "SECURITY_VIOLATION")

    def test_dunder_attribute_chain_blocked(self):
        payload = "result = ().__class__.__base__.__subclasses__()"
        out = run_code(payload)
        self.assertEqual(out.get("code"), "SECURITY_VIOLATION")

    def test_unsafe_builtin_name_blocked(self):
        out = run_code("result = eval('1 + 1')")
        self.assertEqual(out.get("code"), "SECURITY_VIOLATION")

    def test_syntax_error_reported(self):
        out = run_code("result = (")
        self.assertEqual(out.get("code"), "SYNTAX_ERROR")


class OtherToolGuardTests(unittest.TestCase):
    def test_calculator_rejects_non_math_characters(self):
        out = calculator("__import__('os').system('ls')")
        self.assertTrue(out.get("error"))

    def test_read_file_rejects_traversal(self):
        out = read_file("../../etc/passwd")
        self.assertEqual(out.get("code"), "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
