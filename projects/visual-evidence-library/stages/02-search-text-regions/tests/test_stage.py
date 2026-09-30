import unittest
from main import terms, search


def assets():
    return [
        {
            "id": "z",
            "regions": [
                {
                    "id": "r",
                    "text": "Café bicycle repair",
                    "bbox": [1, 2, 3, 4],
                    "origin": "provided",
                }
            ],
        },
        {
            "id": "a",
            "regions": [
                {
                    "id": "r",
                    "text": "Bicycle parking",
                    "bbox": [5, 6, 7, 8],
                    "origin": "provided",
                }
            ],
        },
    ]


class SearchTests(unittest.TestCase):
    def test_unique_unicode_tokens(self):
        self.assertEqual(terms("CAFÉ café, bicycle!"), {"café", "bicycle"})

    def test_coverage_preserves_original_evidence(self):
        r = search(assets(), "bicycle repair")
        self.assertEqual(r[0]["score"], 1)
        self.assertEqual(r[1]["score"], 0.5)
        self.assertEqual(r[0]["bbox"], [1, 2, 3, 4])
        self.assertEqual(r[0]["text"], "Café bicycle repair")

    def test_repeated_query_does_not_change_coverage(self):
        self.assertEqual(
            search(assets(), "bicycle bicycle repair"),
            search(assets(), "bicycle repair"),
        )

    def test_ties_use_asset_identity(self):
        self.assertEqual(
            [r["asset_id"] for r in search(assets(), "bicycle")], ["a", "z"]
        )

    def test_empty_unknown_and_no_stemming(self):
        for q in ("", "!!!", "unknown", "bicycles"):
            self.assertEqual(search(assets(), q), [])

    def test_limit_and_invalid_boundaries(self):
        self.assertEqual(len(search(assets(), "bicycle", 1)), 1)
        for limit in (0, 101, True, 1.5):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                search(assets(), "bicycle", limit)
