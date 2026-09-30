"""Stage 01 tests: load the corpus and rank documents with BM25.

Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 1
"""

import json
import tempfile
import unittest
from pathlib import Path

from report_agent.corpus import Document, load_corpus
from report_agent.search import BM25Index, tokenize

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"


class LoadCorpusTests(unittest.TestCase):
    def setUp(self):
        self.docs = load_corpus(CORPUS)

    def test_loads_every_markdown_file_in_sorted_order(self):
        self.assertEqual(len(self.docs), 12)
        self.assertEqual(
            [doc.id for doc in self.docs], sorted(doc.id for doc in self.docs)
        )
        self.assertIsInstance(self.docs[0], Document)

    def test_header_fields_are_parsed(self):
        syscalls = next(doc for doc in self.docs if doc.id == "04-user-space-kernel")
        self.assertEqual(syscalls.title, "A user-space kernel intercepts system calls")
        self.assertEqual(
            syscalls.source_url,
            "https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html",
        )
        self.assertEqual(syscalls.published, "2026-09-28")

    def test_body_excludes_header(self):
        for doc in self.docs:
            self.assertFalse(doc.text.startswith("title:"), doc.id)
            self.assertNotIn("source_url:", doc.text, doc.id)
            self.assertEqual(doc.text, doc.text.strip(), doc.id)

    def test_missing_header_key_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "bad.md").write_text("title: Only a title\n\nBody text.\n")
            with self.assertRaises(ValueError):
                load_corpus(tmp)


class TokenizeTests(unittest.TestCase):
    def test_lowercases_and_drops_punctuation(self):
        self.assertEqual(
            tokenize("user-space kernel, microVM monitor!"),
            ["user", "space", "kernel", "microvm", "monitor"],
        )

    def test_drops_stopwords(self):
        self.assertEqual(tokenize("What is the kernel of a VM"), ["kernel", "vm"])


class BM25Tests(unittest.TestCase):
    def setUp(self):
        self.index = BM25Index(load_corpus(CORPUS))

    def test_known_queries_rank_the_right_document_first(self):
        cases = {
            "container socket daemon": "03-daemon-socket-escape",
            "interceptor application kernel": "04-user-space-kernel",
            "microVM monitor virtual devices": "05-microvm-monitor",
            "egress allowlist exfiltration": "08-egress-network-policy",
        }
        for query, expected in cases.items():
            with self.subTest(query=query):
                self.assertEqual(self.index.search(query, k=3)[0][0], expected)

    def test_results_are_sorted_and_limited(self):
        results = self.index.search("kernel container sandbox", k=4)
        self.assertEqual(len(results), 4)
        scores = [score for _, score in results]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_unknown_terms_return_nothing(self):
        self.assertEqual(self.index.search("zebra quasar", k=5), [])

    def test_rare_terms_weigh_more_than_common_terms(self):
        self.assertGreater(self.index.idf["interceptor"], self.index.idf["kernel"])

    def test_heldout_questions_find_an_expected_document_in_top_three(self):
        questions = json.loads((PROJECT / "heldout" / "questions.json").read_text())[
            "questions"
        ]
        hits = 0
        for item in questions:
            top = [doc_id for doc_id, _ in self.index.search(item["question"], k=3)]
            hits += any(doc_id in top for doc_id in item["expected_docs"])
        self.assertGreaterEqual(hits / len(questions), 0.8)


if __name__ == "__main__":
    unittest.main()
