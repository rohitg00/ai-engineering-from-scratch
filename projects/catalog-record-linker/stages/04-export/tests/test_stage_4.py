import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def cats(self):
        return (
            import_catalog("id,title\n1,A", "a"),
            import_catalog("id,title\n2,B", "b"),
        )

    def test_crosswalk(self):
        a, b = self.cats()
        self.assertEqual(
            len(list(csv.DictReader(io.StringIO(export_catalog(a, b)["crosswalk"])))), 2
        )

    def test_stale(self):
        a, b = self.cats()
        with self.assertRaises(ValueError):
            export_catalog(a, b, {"fingerprint": "bad"})

    def test_review_roundtrip(self):
        a, b = self.cats()
        r = export_catalog(a, b)
        s = export_catalog(
            a,
            b,
            {
                "fingerprint": r["fingerprint"],
                "pairs": [
                    {
                        "left": "a:1",
                        "right": "b:2",
                        "match": True,
                        "values": {"title": "Combined"},
                    }
                ],
            },
        )
        self.assertTrue(s["ready"])
        self.assertEqual(len(s["entities"]), 1)

    def test_unresolved(self):
        a, b = self.cats()
        r = export_catalog(a, b)
        self.assertFalse(
            export_catalog(
                a,
                b,
                {
                    "fingerprint": r["fingerprint"],
                    "pairs": [{"left": "a:1", "right": "b:2", "match": True}],
                },
            )["ready"]
        )

    def test_preservation(self):
        a, b = self.cats()
        self.assertEqual(export_catalog(a, b)["entities"][0]["sources"][0], a[0])
