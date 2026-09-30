import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import query


class IntegrationTests(unittest.TestCase):
    def test_question_changes_extracted_evidence(self):
        r = query(W / "samples/docs", "When do cache entries expire?")
        self.assertIn("cache", r["answer"].lower())
        self.assertEqual(len(r["citations"][0]["sha256"]), 64)

    def test_unknown_query_abstains(self):
        self.assertEqual(query(W / "samples/docs", "zebras")["state"], "abstained")

    def test_verbatim_but_irrelevant_requires_review(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "a.txt").write_text(
                "Cache expires in sixty seconds. Bananas are yellow."
            )
            r = query(
                d,
                "When does cache expire?",
                lambda p: json.dumps(
                    {"source": "a.txt:0", "quote": "Bananas are yellow."}
                ),
            )
            self.assertEqual(r["state"], "needs_review")

    def test_fabricated_quote_is_rejected(self):
        with self.assertRaises(ValueError):
            query(
                W / "samples/docs",
                "cache",
                lambda p: json.dumps({"source": "cache.txt:0", "quote": "forever"}),
            )

    def test_actual_folder_cli(self):
        with tempfile.TemporaryDirectory() as d:
            p = subprocess.run(
                [
                    sys.executable,
                    str(W / "cli.py"),
                    str(W / "samples/docs"),
                    "cache",
                    "--output",
                    d + "/answer.json",
                    "--html",
                    d + "/answer.html",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertEqual(
                json.loads(Path(d + "/answer.json").read_text())["mode"],
                "local-extractive",
            )
