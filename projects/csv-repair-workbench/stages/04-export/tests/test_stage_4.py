import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_review(self):
        t = profile("d\n03/04/2026")
        p = propose(t, date_columns=["d"])
        r = preview(t, p)
        v = repair(
            t,
            p,
            {
                "fingerprint": r["fingerprint"],
                "cells": [{"row": 1, "column": "d", "value": "2026-04-03"}],
            },
        )
        self.assertFalse(v["pending"])
        self.assertIn("2026-04-03", v["csv"])

    def test_stale(self):
        t = profile("a\nx")
        with self.assertRaises(ValueError):
            repair(t, propose(t), {"fingerprint": "bad"})

    def test_roundtrip(self):
        t = profile('a,b\n"x,y",0')
        self.assertEqual(profile(repair(t, propose(t))["csv"])["rows"], t["rows"])

    def test_replay(self):
        t = profile("a\n x ")
        r = repair(t, propose(t))
        u = profile(r["csv"])
        self.assertFalse(repair(u, r["recipe"])["changes"])

    def test_nonpending(self):
        t = profile("a\nx")
        p = propose(t)
        r = preview(t, p)
        with self.assertRaises(ValueError):
            repair(
                t,
                p,
                {
                    "fingerprint": r["fingerprint"],
                    "cells": [{"row": 1, "column": "a", "value": "2026-01-01"}],
                },
            )
