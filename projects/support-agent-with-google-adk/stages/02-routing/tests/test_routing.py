import unittest
import tempfile
from pathlib import Path
from routing import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(route("refund invoice"), "billing")

    def test_02(self):
        self.assertEqual(route("login password"), "access")

    def test_03(self):
        self.assertEqual(route("refund password"), "human")

    def test_04(self):
        self.assertEqual(route("unclassified"), "human")

    def test_05(self):
        self.assertFalse(authorize("billing", "read_account"))
        self.assertTrue(authorize("billing", "read_invoice"))
