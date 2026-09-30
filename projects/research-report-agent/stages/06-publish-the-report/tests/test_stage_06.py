"""Stage 06 tests: HTML report with footnotes, trace schema, full pipeline.

Lesson: projects/research-report-agent/stages/06-publish-the-report/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 6
"""

import json
import re
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

from report_agent.critic import Budget
from report_agent.pipeline import run_pipeline

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"
QUESTION = "Why is mounting the container socket into an agent container dangerous?"


class TagCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = set()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append(tag)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if "href" in attrs:
            self.hrefs.append(attrs["href"])


class PublishTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.report, cls.trace, cls.html = run_pipeline(
            QUESTION, CORPUS, out_dir=cls.tmp.name
        )
        cls.parser = TagCollector()
        cls.parser.feed(cls.html)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_files_are_written(self):
        self.assertTrue((Path(self.tmp.name) / "report.html").exists())
        payload = json.loads((Path(self.tmp.name) / "report.json").read_text())
        self.assertEqual(payload["schema_version"], 1)
        self.assertEqual(payload["question"], QUESTION)
        trace = json.loads((Path(self.tmp.name) / "trace.json").read_text())
        self.assertEqual(trace["run_id"], self.trace["run_id"])

    def test_html_has_title_sections_and_footnotes(self):
        self.assertIn("h1", self.parser.tags)
        self.assertGreaterEqual(self.parser.tags.count("h2"), 3)
        self.assertIn("ol", self.parser.tags)

    def test_every_reference_has_a_matching_footnote(self):
        refs = re.findall(r'href="#fn-(\d+)"', self.html)
        self.assertTrue(refs)
        for number in set(refs):
            self.assertIn(f"fn-{number}", self.parser.ids)
        numbers = sorted({int(n) for n in refs})
        self.assertEqual(numbers, list(range(1, len(numbers) + 1)))

    def test_sources_link_to_real_urls(self):
        external = [href for href in self.parser.hrefs if href.startswith("http")]
        self.assertTrue(external)
        self.assertTrue(all(href.startswith("https://") for href in external))

    def test_text_is_escaped(self):
        self.assertNotIn("<script", self.html.lower())

    def test_trace_schema(self):
        for key in (
            "run_id",
            "question",
            "started_at",
            "steps",
            "counts",
            "budget",
            "terminal_state",
        ):
            self.assertIn(key, self.trace)
        names = [step["name"] for step in self.trace["steps"]]
        self.assertEqual(names, ["index", "plan", "gather", "write", "verify"])
        self.assertTrue(all(step["ms"] >= 0 for step in self.trace["steps"]))
        self.assertIn(
            self.trace["terminal_state"], ("completed", "needs_review", "failed")
        )
        self.assertEqual(
            self.trace["counts"]["sentences"], self.report.sentence_count()
        )

    def test_tiny_budget_fails_cleanly(self):
        report, trace, html_text = run_pipeline(
            QUESTION, CORPUS, budget=Budget(max_steps=2, max_tokens=10_000)
        )
        self.assertEqual(trace["terminal_state"], "failed")
        self.assertEqual(trace["steps"][-1]["name"], "budget_exceeded")
        self.assertIn("<h1>", html_text)


if __name__ == "__main__":
    unittest.main()
