import unittest
import tempfile
from pathlib import Path
from audit import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(audit_catalog()["tools"], 250)

    def test_02(self):
        self.assertEqual(audit_catalog()["pages"], 8)

    def test_03(self):
        self.assertIn("pods_count", audit_catalog()["names"])

    def test_04(self):
        self.assertEqual(len(set(audit_catalog()["names"])), 250)

    def test_05(self):
        self.assertEqual(audit_catalog(), audit_catalog())
