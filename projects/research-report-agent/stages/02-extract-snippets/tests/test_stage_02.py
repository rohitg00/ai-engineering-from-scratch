"""Stage 02 tests: sentence spans and snippets with exact offsets.

Lesson: projects/research-report-agent/stages/02-extract-snippets/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 2
"""

import unittest
from pathlib import Path

from report_agent.corpus import load_corpus
from report_agent.search import BM25Index, tokenize
from report_agent.snippets import Snippet, extract_snippets, split_sentences

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"


class SplitSentencesTests(unittest.TestCase):
    def test_spans_cover_sentences_without_outer_whitespace(self):
        text = "First one.  Second one!\nThird one?"
        spans = split_sentences(text)
        self.assertEqual(
            [text[s:e] for s, e in spans], ["First one.", "Second one!", "Third one?"]
        )

    def test_path_with_dot_does_not_split(self):
        text = "The socket is at /var/run/container.sock. Any process can write."
        pieces = [text[s:e] for s, e in split_sentences(text)]
        self.assertEqual(
            pieces,
            ["The socket is at /var/run/container.sock.", "Any process can write."],
        )

    def test_lowercase_word_starts_a_new_sentence(self):
        text = "It is slower for some work. user-space kernel is still useful."
        self.assertEqual(len(split_sentences(text)), 2)

    def test_trailing_text_without_period_is_kept(self):
        text = "One sentence. A fragment"
        self.assertEqual(
            [text[s:e] for s, e in split_sentences(text)][-1], "A fragment"
        )


class ExtractSnippetsTests(unittest.TestCase):
    def setUp(self):
        self.docs = load_corpus(CORPUS)
        self.by_id = {doc.id: doc for doc in self.docs}
        self.index = BM25Index(self.docs)

    def test_snippet_text_equals_source_span(self):
        snippets = extract_snippets(
            "How does user-space kernel intercept system calls?", self.index
        )
        self.assertTrue(snippets)
        for snippet in snippets:
            self.assertIsInstance(snippet, Snippet)
            self.assertEqual(
                self.by_id[snippet.doc_id].text[snippet.start : snippet.end],
                snippet.text,
            )

    def test_ids_are_sequential_from_start_id(self):
        snippets = extract_snippets("microVM kernel isolation", self.index, start_id=5)
        self.assertEqual(
            [s.id for s in snippets], [f"S{n}" for n in range(5, 5 + len(snippets))]
        )

    def test_every_snippet_shares_a_term_with_the_query(self):
        query = "secrets proxy credential"
        terms = set(tokenize(query))
        for snippet in extract_snippets(query, self.index):
            self.assertTrue(terms & set(tokenize(snippet.text)), snippet.text)

    def test_limits_per_document(self):
        snippets = extract_snippets(
            "container kernel escape", self.index, k_docs=2, per_doc=2
        )
        counts = {}
        for snippet in snippets:
            counts[snippet.doc_id] = counts.get(snippet.doc_id, 0) + 1
        self.assertLessEqual(len(counts), 2)
        self.assertTrue(all(count <= 2 for count in counts.values()))

    def test_sorted_by_score(self):
        snippets = extract_snippets("microVM monitor microVM guest kernel", self.index)
        scores = [s.score for s in snippets]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_doc_ids_restricts_the_search(self):
        snippets = extract_snippets(
            "kernel", self.index, doc_ids=["06-virtualized-containers"]
        )
        self.assertTrue(snippets)
        self.assertEqual({s.doc_id for s in snippets}, {"06-virtualized-containers"})

    def test_short_or_context_dependent_sentences_rank_lower(self):
        snippets = extract_snippets(
            "user-space kernel cost performance tradeoff",
            self.index,
            k_docs=1,
            per_doc=10,
        )
        texts = [s.text for s in snippets]
        self.assertNotIn("The tradeoff is overhead.", texts)


if __name__ == "__main__":
    unittest.main()
