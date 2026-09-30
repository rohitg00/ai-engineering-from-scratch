"""Stage 04 tests: citation validator and the extractive cited writer.

Lesson: projects/research-report-agent/stages/04-write-with-citations/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 4
"""

import unittest
from pathlib import Path

from report_agent.citations import (
    cites_of,
    report_sentences,
    strip_cites,
    validate_citations,
)
from report_agent.corpus import load_corpus
from report_agent.planner import plan_research
from report_agent.search import BM25Index
from report_agent.writer import (
    CitedSentence,
    Report,
    gather_snippets,
    to_markdown,
    write_report,
)

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"


class CitationTests(unittest.TestCase):
    def test_cites_are_read_from_the_end_of_a_sentence(self):
        self.assertEqual(cites_of("Kernels differ [S2][S7]."), ["S2", "S7"])
        self.assertEqual(cites_of("No citation here."), [])

    def test_strip_cites(self):
        self.assertEqual(strip_cites("Kernels differ [S2][S7]."), "Kernels differ")

    def test_headings_are_ignored_and_sentences_split(self):
        markdown = "# Title\n\n## Part\n\nOne claim [S1]. user-space kernel claim [S2]. Another claim [S1]."
        self.assertEqual(len(report_sentences(markdown)), 3)

    def test_uncited_sentence_is_rejected(self):
        errors = validate_citations("## A\n\nCited [S1]. Not cited at all.", {"S1"})
        self.assertEqual([e.reason for e in errors], ["uncited"])

    def test_dangling_citation_is_rejected(self):
        errors = validate_citations("## A\n\nCited [S1][S4].", {"S1"})
        self.assertEqual([e.reason for e in errors], ["dangling:S4"])

    def test_clean_report_has_no_errors(self):
        self.assertEqual(
            validate_citations("# Q\n\n## A\n\nOne [S1]. Two [S2].", {"S1", "S2"}), []
        )


class WriterTests(unittest.TestCase):
    def setUp(self):
        self.index = BM25Index(load_corpus(CORPUS))
        self.plan = plan_research(
            "How does a secrets proxy protect API keys from prompt injection?"
        )
        self.by_facet = gather_snippets(self.plan, self.index)
        self.report = write_report(self.plan, self.by_facet)
        self.markdown = to_markdown(self.report)

    def test_rendered_sentence_format(self):
        self.assertEqual(
            CitedSentence("Keys stay outside.", ("S3",)).render(),
            "Keys stay outside [S3].",
        )

    def test_snippet_ids_are_unique_across_facets(self):
        ids = [s.id for group in self.by_facet.values() for s in group]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_sentence_is_cited_and_resolves(self):
        self.assertIsInstance(self.report, Report)
        self.assertEqual(
            validate_citations(self.markdown, self.report.snippets.keys()), []
        )

    def test_writer_invents_nothing(self):
        for section in self.report.sections:
            for sentence in section.sentences:
                source = " ".join(self.report.snippets[sentence.cites[0]].text.split())
                self.assertEqual(sentence.text, source)

    def test_markdown_has_title_and_sections(self):
        self.assertTrue(self.markdown.startswith("# How does a secrets proxy"))
        self.assertGreaterEqual(self.markdown.count("\n## "), 2)

    def test_max_sentences_per_section(self):
        report = write_report(self.plan, self.by_facet, max_sentences=1)
        self.assertTrue(all(len(section.sentences) == 1 for section in report.sections))


if __name__ == "__main__":
    unittest.main()
