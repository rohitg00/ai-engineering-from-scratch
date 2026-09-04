"""Tests for exact_match, F1, BLEU-4, ROUGE-L, accuracy, and dispatch."""

from __future__ import annotations

import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    accuracy,
    bleu4,
    corpus_bleu,
    corpus_mean,
    exact_match,
    f1_score,
    lcs_length,
    rouge_l,
    score,
    tokenize,
    _brevity_penalty,
    _modified_precision,
    _ngram_counts,
)


class TestTokenize(unittest.TestCase):
    def test_basic_tokenize(self) -> None:
        self.assertEqual(tokenize("The Cat, sat!"), ["the", "cat", "sat"])

    def test_empty(self) -> None:
        self.assertEqual(tokenize(""), [])

    def test_numbers_kept(self) -> None:
        self.assertEqual(tokenize("answer is 41"), ["answer", "is", "41"])


class TestExactMatch(unittest.TestCase):
    def test_hit(self) -> None:
        self.assertEqual(exact_match("41", ["41"]), 1.0)

    def test_miss(self) -> None:
        self.assertEqual(exact_match("42", ["41"]), 0.0)

    def test_strips_whitespace(self) -> None:
        self.assertEqual(exact_match("  41  ", ["41"]), 1.0)

    def test_multi_target_any_hit(self) -> None:
        self.assertEqual(exact_match("yes", ["positive", "yes"]), 1.0)

    def test_empty_targets(self) -> None:
        self.assertEqual(exact_match("anything", []), 0.0)

    def test_accuracy_alias(self) -> None:
        self.assertEqual(accuracy("x", ["x"]), 1.0)


class TestF1(unittest.TestCase):
    def test_identical(self) -> None:
        self.assertAlmostEqual(f1_score("the cat", "the cat"), 1.0)

    def test_disjoint(self) -> None:
        self.assertEqual(f1_score("apple", "orange"), 0.0)

    def test_partial(self) -> None:
        s = f1_score("the cat sat", "a cat sat on the mat")
        self.assertGreater(s, 0.4)
        self.assertLess(s, 0.7)

    def test_empty_prediction(self) -> None:
        self.assertEqual(f1_score("", "target"), 0.0)

    def test_empty_target(self) -> None:
        self.assertEqual(f1_score("pred", ""), 0.0)

    def test_both_empty(self) -> None:
        self.assertEqual(f1_score("", ""), 1.0)

    def test_repeated_token_counts_once_per_overlap(self) -> None:
        s1 = f1_score("cat cat cat", "cat")
        s2 = f1_score("cat", "cat cat cat")
        self.assertEqual(s1, s2)


class TestNgram(unittest.TestCase):
    def test_unigram(self) -> None:
        c = _ngram_counts(["a", "b", "a"], 1)
        self.assertEqual(c[("a",)], 2)
        self.assertEqual(c[("b",)], 1)

    def test_4gram_short_text(self) -> None:
        self.assertEqual(_ngram_counts(["a", "b"], 4), {})

    def test_modified_precision_clips(self) -> None:
        cand = ["the", "the", "the", "the"]
        ref = ["the", "cat", "sat"]
        clipped, total = _modified_precision(cand, ref, 1)
        self.assertEqual(clipped, 1)
        self.assertEqual(total, 4)


class TestBLEU(unittest.TestCase):
    def test_perfect_match(self) -> None:
        s = bleu4("the cat sat on the mat", "the cat sat on the mat")
        self.assertAlmostEqual(s, 1.0, places=2)

    def test_no_match(self) -> None:
        s = bleu4("apple banana cherry date", "the cat sat on the mat")
        self.assertLess(s, 0.3)

    def test_repetition_penalised(self) -> None:
        s = bleu4("the the the the", "the cat sat on the mat")
        self.assertLess(s, 0.5)

    def test_brevity_penalty(self) -> None:
        long_ref = "the cat sat on the mat in the sun on a quiet day"
        s_short = bleu4("the cat", long_ref)
        s_full = bleu4(long_ref, long_ref)
        self.assertLess(s_short, s_full)

    def test_brevity_penalty_function(self) -> None:
        self.assertEqual(_brevity_penalty(10, 10), 1.0)
        self.assertEqual(_brevity_penalty(15, 10), 1.0)
        bp = _brevity_penalty(5, 10)
        self.assertAlmostEqual(bp, math.exp(1 - 10 / 5), places=6)
        self.assertEqual(_brevity_penalty(0, 5), 0.0)

    def test_empty_candidate(self) -> None:
        self.assertEqual(bleu4("", "the cat"), 0.0)

    def test_corpus_bleu(self) -> None:
        preds = ["the cat sat", "the dog ran"]
        refs = ["the cat sat", "the dog ran"]
        s = corpus_bleu(preds, refs)
        self.assertGreater(s, 0.5)


class TestRougeL(unittest.TestCase):
    def test_lcs_basic(self) -> None:
        self.assertEqual(lcs_length(["a", "b", "c", "d"], ["a", "c", "d"]), 3)

    def test_lcs_empty(self) -> None:
        self.assertEqual(lcs_length([], ["a"]), 0)
        self.assertEqual(lcs_length(["a"], []), 0)

    def test_perfect(self) -> None:
        self.assertAlmostEqual(rouge_l("the cat sat", "the cat sat"), 1.0)

    def test_disjoint(self) -> None:
        self.assertEqual(rouge_l("apple", "banana"), 0.0)

    def test_partial(self) -> None:
        s = rouge_l("the cat sat", "the cat sat on the mat")
        self.assertGreater(s, 0.6)
        self.assertLess(s, 0.85)

    def test_word_order_matters(self) -> None:
        s_in_order = rouge_l("a b c", "a b c d")
        s_reverse = rouge_l("c b a", "a b c d")
        self.assertGreater(s_in_order, s_reverse)


class TestDispatcher(unittest.TestCase):
    def test_dispatch_exact_match(self) -> None:
        self.assertEqual(score("exact_match", "41", ["41"]), 1.0)

    def test_dispatch_accuracy(self) -> None:
        self.assertEqual(score("accuracy", "yes", ["yes"]), 1.0)

    def test_dispatch_f1(self) -> None:
        s = score("f1", "the cat", ["a cat"])
        self.assertGreater(s, 0.0)

    def test_dispatch_bleu(self) -> None:
        s = score("bleu_4", "the cat sat", ["the cat sat"])
        self.assertGreater(s, 0.5)

    def test_dispatch_rouge_l(self) -> None:
        s = score("rouge_l", "the cat sat", ["the cat sat"])
        self.assertAlmostEqual(s, 1.0)

    def test_unknown_metric_raises(self) -> None:
        with self.assertRaises(ValueError):
            score("perplexity", "x", ["y"])

    def test_multi_target_takes_max(self) -> None:
        s = score("f1", "the cat", ["a horse", "the cat"])
        self.assertGreater(s, 0.5)

    def test_empty_targets_returns_zero(self) -> None:
        self.assertEqual(score("f1", "x", []), 0.0)


class TestCorpus(unittest.TestCase):
    def test_corpus_mean(self) -> None:
        self.assertAlmostEqual(corpus_mean([1.0, 0.0, 0.5]), 0.5)

    def test_corpus_mean_empty(self) -> None:
        self.assertEqual(corpus_mean([]), 0.0)


if __name__ == "__main__":
    unittest.main()
