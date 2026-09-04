"""Tests for the five chunking strategies and the recall eval harness."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    Chunk,
    DenseIndex,
    build_fixture,
    eval_recall,
    fixed_window,
    mock_embed,
    recursive_split,
    semantic_chunks,
    sentence_chunks,
    structural_markdown,
    STRATEGIES,
)


SAMPLE_PROSE = (
    "Alpha is the first letter. Beta is the second letter. Gamma is the third letter. "
    "Delta is the fourth letter. Epsilon is the fifth letter. Zeta is the sixth letter. "
    "Eta is the seventh letter. Theta is the eighth letter."
)

SAMPLE_MD = (
    "# Top\n\nintro paragraph\n\n## A\n\ncontent of A section spanning a line\n\n"
    "## B\n\ncontent of B section spanning another line\n\n### B sub\n\nnested chunk content"
)


class TestFixedWindow(unittest.TestCase):
    def test_emits_at_least_one_chunk(self) -> None:
        chunks = fixed_window("d", SAMPLE_PROSE, size=80, overlap=20)
        self.assertGreaterEqual(len(chunks), 2)

    def test_overlap_visible(self) -> None:
        chunks = fixed_window("d", SAMPLE_PROSE, size=60, overlap=20)
        # Adjacent chunks must share at least the overlap region size by construction
        for a, b in zip(chunks, chunks[1:]):
            self.assertGreaterEqual(a.end - b.start, 20)

    def test_rejects_bad_args(self) -> None:
        with self.assertRaises(ValueError):
            fixed_window("d", "x", size=0)
        with self.assertRaises(ValueError):
            fixed_window("d", "x", size=10, overlap=10)


class TestSentenceChunks(unittest.TestCase):
    def test_does_not_split_mid_word(self) -> None:
        chunks = sentence_chunks("d", SAMPLE_PROSE, target=60)
        for c in chunks:
            self.assertNotEqual(c.text.split()[0][:1], "")
            self.assertFalse(c.text.startswith(" "))

    def test_full_coverage(self) -> None:
        chunks = sentence_chunks("d", SAMPLE_PROSE, target=80)
        joined = " ".join(c.text for c in chunks)
        for word in ("Alpha", "Zeta", "Theta"):
            self.assertIn(word, joined)


class TestRecursiveSplit(unittest.TestCase):
    def test_respects_target_when_possible(self) -> None:
        chunks = recursive_split("d", SAMPLE_PROSE, target=80)
        for c in chunks:
            self.assertLessEqual(len(c.text), 200)

    def test_handles_short_input(self) -> None:
        chunks = recursive_split("d", "short input", target=500)
        self.assertEqual(len(chunks), 1)


class TestSemantic(unittest.TestCase):
    def test_low_threshold_packs_into_few_chunks(self) -> None:
        chunks = semantic_chunks("d", SAMPLE_PROSE, similarity_threshold=0.0, max_chars=2000)
        self.assertLessEqual(len(chunks), 2)

    def test_high_threshold_splits_more(self) -> None:
        many = semantic_chunks("d", SAMPLE_PROSE, similarity_threshold=0.99, max_chars=2000)
        few = semantic_chunks("d", SAMPLE_PROSE, similarity_threshold=0.1, max_chars=2000)
        self.assertGreaterEqual(len(many), len(few))


class TestStructuralMarkdown(unittest.TestCase):
    def test_one_chunk_per_header(self) -> None:
        chunks = structural_markdown("d", SAMPLE_MD)
        self.assertEqual(len(chunks), 4)
        self.assertTrue(chunks[0].text.startswith("# Top"))
        self.assertTrue(any("B sub" in c.text for c in chunks))

    def test_returns_whole_doc_when_no_headers(self) -> None:
        chunks = structural_markdown("d", "no headers in this doc")
        self.assertEqual(len(chunks), 1)


class TestMockEmbed(unittest.TestCase):
    def test_deterministic(self) -> None:
        self.assertEqual(mock_embed("abort threshold"), mock_embed("abort threshold"))

    def test_normalized(self) -> None:
        v = mock_embed("hello world")
        s = sum(x * x for x in v)
        self.assertAlmostEqual(s, 1.0, places=4)


class TestDenseIndex(unittest.TestCase):
    def test_returns_topk(self) -> None:
        idx = DenseIndex()
        for token in ("alpha apple", "beta banana", "gamma grape"):
            idx.add(Chunk("d", "test", 0, len(token), token))
        top = idx.search("banana", 2)
        self.assertEqual(len(top), 2)
        self.assertIn("banana", top[0].text)


class TestEvalRecall(unittest.TestCase):
    def test_recall_is_a_fraction(self) -> None:
        fixture = build_fixture()
        for name, fn in STRATEGIES.items():
            r = eval_recall(fn, fixture, ks=(1, 3, 5))
            for k, v in r.items():
                self.assertGreaterEqual(v, 0.0, f"{name} recall@{k}")
                self.assertLessEqual(v, 1.0, f"{name} recall@{k}")

    def test_recall_monotonic_in_k(self) -> None:
        fixture = build_fixture()
        for name, fn in STRATEGIES.items():
            r = eval_recall(fn, fixture, ks=(1, 3, 5))
            self.assertLessEqual(r[1], r[3], f"{name} recall@1 vs @3")
            self.assertLessEqual(r[3], r[5], f"{name} recall@3 vs @5")


if __name__ == "__main__":
    unittest.main()
