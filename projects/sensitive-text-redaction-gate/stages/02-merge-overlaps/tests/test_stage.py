import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_overlap_union(self):
        spans = [
            {"start": 2, "end": 7, "kind": "EMAIL"},
            {"start": 5, "end": 10, "kind": "LITERAL"},
        ]
        self.assertEqual(
            merge_spans(spans, 12),
            [{"start": 2, "end": 10, "kinds": ["EMAIL", "LITERAL"]}],
        )

    def test_nested(self):
        spans = [
            {"start": 0, "end": 10, "kind": "EMAIL"},
            {"start": 2, "end": 3, "kind": "LITERAL"},
        ]
        self.assertEqual(merge_spans(spans, 10)[0]["end"], 10)

    def test_adjacent_stay_separate(self):
        spans = [
            {"start": 0, "end": 2, "kind": "LITERAL"},
            {"start": 2, "end": 4, "kind": "LITERAL"},
        ]
        self.assertEqual(len(merge_spans(spans, 4)), 2)

    def test_sort_and_duplicate(self):
        span = {"start": 1, "end": 3, "kind": "LITERAL"}
        self.assertEqual(len(merge_spans([span, span], 4)), 1)
        self.assertEqual(span, {"start": 1, "end": 3, "kind": "LITERAL"})

    def test_invalid_offsets(self):
        for start, end in [(True, 2), (-1, 2), (2, 2), (1, 11)]:
            with self.assertRaises(ValueError):
                merge_spans([{"start": start, "end": end, "kind": "EMAIL"}], 10)

    def test_unknown_kind(self):
        with self.assertRaises(ValueError):
            merge_spans([{"start": 0, "end": 1, "kind": "PERSON"}], 2)

    def test_empty(self):
        self.assertEqual(merge_spans([], 0), [])
