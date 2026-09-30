import unittest
import tempfile
from pathlib import Path
from claims import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            parse_claims("# Heading\n\nOne claim [S1].")[0]["cites"], ["S1"]
        )

    def test_02(self):
        self.assertEqual(len(parse_claims("One [S1]. Two [S2].")), 2)

    def test_03(self):
        self.assertEqual(parse_claims("One [S1][S1].")[0]["cites"], ["S1"])

    def test_04(self):
        self.assertEqual(parse_claims("An uncited claim.")[0]["cites"], [])

    def test_05(self):
        self.assertEqual(parse_claims("  \n# Only heading"), [])
