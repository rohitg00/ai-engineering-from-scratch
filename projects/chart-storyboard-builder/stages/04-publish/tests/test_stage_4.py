import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def spec(self, grammar="bar"):
        return aggregate(
            parse_table(
                "g,n\nA,2\nC,3", {"group": "g", "value": "n", "unit": "people"}
            ),
            periods=["A", "B", "C"],
            grammar=grammar,
        )

    def test_accessible(self):
        self.assertIn("aria-labelledby", render_svg(self.spec()))

    def test_gaps(self):
        self.assertEqual(render_svg(self.spec("line")).count("<line "), 1)

    def test_escape(self):
        s = self.spec()
        s["points"][0]["group"] = "<script>"
        self.assertNotIn("<script>", render_svg(s))
        self.assertIn("&lt;script&gt;", render_svg(s))

    def test_axis(self):
        s = self.spec()
        s["axis"] = {"min": 1, "max": 5}
        with self.assertRaises(ValueError):
            render_svg(s)

    def test_heldout_negative(self):
        s = aggregate(
            parse_table("g,n\nloss,-8", {"group": "g", "value": "n", "unit": "kg"})
        )
        self.assertEqual(s["axis"]["min"], -8)
        self.assertIn('height="260.0"', render_svg(s))
