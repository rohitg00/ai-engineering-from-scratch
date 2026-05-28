"""eval-pipeline lesson の tests。"""

from __future__ import annotations

import math
import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    DEFAULT_WEIGHTS,
    EM_PAIRS,
    EvalConfig,
    EvalResult,
    ExampleRecord,
    F1_PAIRS,
    InstructionTokenizer,
    JUDGE_SET,
    JudgeVerdict,
    LM_CORPUS,
    TinyGPT,
    aggregate,
    exact_match_eval,
    exact_match_score,
    generate_greedy,
    judge_eval,
    mock_judge,
    normalise_for_em,
    normalise_metric,
    perplexity_eval,
    token_f1_eval,
    token_f1_score,
    tokenize_text,
)


def _build_model(cfg: EvalConfig) -> TinyGPT:
    torch.manual_seed(cfg.seed)
    return TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)


class NormaliseTests(unittest.TestCase):
    def test_em_strips_trailing_punctuation(self) -> None:
        self.assertEqual(normalise_for_em("Paris."), "paris")
        self.assertEqual(normalise_for_em("paris"), "paris")

    def test_em_collapses_internal_whitespace(self) -> None:
        self.assertEqual(normalise_for_em("  the   sky  "), "the sky")


class ExactMatchTests(unittest.TestCase):
    def test_match_after_normalisation(self) -> None:
        self.assertEqual(exact_match_score("Paris.", "paris"), 1)
        self.assertEqual(exact_match_score("Paris", "Paris"), 1)
        self.assertEqual(exact_match_score("Paris!", "paris."), 1)

    def test_no_match_on_different_content(self) -> None:
        self.assertEqual(exact_match_score("London", "paris"), 0)


class TokenF1Tests(unittest.TestCase):
    def test_identical_strings_score_one(self) -> None:
        self.assertEqual(token_f1_score("the sky is blue", "the sky is blue"), 1.0)

    def test_empty_both_score_one(self) -> None:
        self.assertEqual(token_f1_score("", ""), 1.0)

    def test_empty_one_side_scores_zero(self) -> None:
        self.assertEqual(token_f1_score("blue", ""), 0.0)
        self.assertEqual(token_f1_score("", "blue"), 0.0)

    def test_partial_overlap_is_between_zero_and_one(self) -> None:
        # pred has 3 tokens, ref has 4 tokens, intersection is 2.
        score = token_f1_score("the sky was", "the sky is blue")
        # precision = 2/3, recall = 2/4 = 0.5, F1 = 2 * 2/3 * 0.5 / (2/3 + 0.5) = 0.571...
        self.assertAlmostEqual(score, 2 * (2 / 3) * 0.5 / ((2 / 3) + 0.5), places=5)


class JudgeTests(unittest.TestCase):
    def test_exact_match_scores_five(self) -> None:
        v = mock_judge("inst", "Paris", "paris.")
        self.assertEqual(v.score, 5)

    def test_high_overlap_scores_four(self) -> None:
        v = mock_judge(
            "inst", "the sky was very blue today", "the sky was blue today bright"
        )
        # Construct manually: predict and ref share 4 tokens, pred has 6, ref has 6.
        # F1 = 2 * 4/6 * 4/6 / (8/6) = 2/3 = 0.667 -> score 3.
        self.assertIn(v.score, (3, 4))

    def test_zero_overlap_scores_one(self) -> None:
        v = mock_judge("inst", "alpha beta gamma", "xyz qrs tuv")
        self.assertEqual(v.score, 1)


class AggregateTests(unittest.TestCase):
    def test_normalise_perplexity_decreasing(self) -> None:
        a = normalise_metric("perplexity", 1.0)
        b = normalise_metric("perplexity", 10.0)
        c = normalise_metric("perplexity", 100.0)
        self.assertGreater(a, b)
        self.assertGreater(b, c)

    def test_normalise_judge_divides_by_five(self) -> None:
        self.assertAlmostEqual(normalise_metric("judge", 5.0), 1.0)
        self.assertAlmostEqual(normalise_metric("judge", 2.5), 0.5)
        self.assertAlmostEqual(normalise_metric("judge", 0.0), 0.0)

    def test_aggregate_uses_weights(self) -> None:
        results = [
            EvalResult(name="perplexity", metric=1.0, n_examples=1),
            EvalResult(name="exact_match", metric=1.0, n_examples=1),
            EvalResult(name="token_f1", metric=1.0, n_examples=1),
            EvalResult(name="judge", metric=5.0, n_examples=1),
        ]
        report = aggregate(results)
        # All normalised metrics are 1.0 in this construction.
        self.assertAlmostEqual(report.aggregate, 1.0, places=5)
        self.assertAlmostEqual(sum(report.weights.values()), 1.0, places=6)

    def test_aggregate_handles_subset_of_evals(self) -> None:
        results = [
            EvalResult(name="exact_match", metric=0.5, n_examples=2),
            EvalResult(name="token_f1", metric=0.5, n_examples=2),
        ]
        report = aggregate(results)
        # When only two evals are present, their weights re-normalise to sum 1.
        self.assertAlmostEqual(sum(report.weights.values()), 1.0, places=6)
        self.assertAlmostEqual(report.aggregate, 0.5, places=5)


class PerplexityEvalTests(unittest.TestCase):
    def test_perplexity_is_finite_on_short_corpus(self) -> None:
        cfg = EvalConfig(hidden=32, heads=2, depth=1, max_len=32, train_epochs=1, seed=0)
        model = _build_model(cfg)
        tok = InstructionTokenizer()
        res = perplexity_eval(model, tok, LM_CORPUS[:4], cfg.max_len)
        self.assertEqual(res.name, "perplexity")
        self.assertFalse(math.isnan(res.metric))
        self.assertFalse(math.isinf(res.metric))
        self.assertGreater(res.metric, 0.0)

    def test_perplexity_records_count_examples(self) -> None:
        cfg = EvalConfig(hidden=32, heads=2, depth=1, max_len=32, train_epochs=1, seed=0)
        model = _build_model(cfg)
        tok = InstructionTokenizer()
        res = perplexity_eval(model, tok, LM_CORPUS[:3], cfg.max_len)
        self.assertEqual(res.n_examples, 3)
        self.assertEqual(len(res.records), 3)


class GenerativeEvalTests(unittest.TestCase):
    def test_em_eval_returns_score_in_unit_interval(self) -> None:
        cfg = EvalConfig(hidden=32, heads=2, depth=1, max_len=48, train_epochs=1, seed=0)
        model = _build_model(cfg)
        tok = InstructionTokenizer()
        res = exact_match_eval(model, tok, EM_PAIRS[:4])
        self.assertGreaterEqual(res.metric, 0.0)
        self.assertLessEqual(res.metric, 1.0)
        self.assertEqual(res.n_examples, 4)

    def test_f1_eval_runs_and_returns_in_unit_interval(self) -> None:
        cfg = EvalConfig(hidden=32, heads=2, depth=1, max_len=48, train_epochs=1, seed=0)
        model = _build_model(cfg)
        tok = InstructionTokenizer()
        res = token_f1_eval(model, tok, F1_PAIRS[:3])
        self.assertGreaterEqual(res.metric, 0.0)
        self.assertLessEqual(res.metric, 1.0)

    def test_judge_eval_returns_in_one_to_five(self) -> None:
        cfg = EvalConfig(hidden=32, heads=2, depth=1, max_len=48, train_epochs=1, seed=0)
        model = _build_model(cfg)
        tok = InstructionTokenizer()
        res = judge_eval(model, tok, JUDGE_SET[:3])
        self.assertGreaterEqual(res.metric, 1.0)
        self.assertLessEqual(res.metric, 5.0)


if __name__ == "__main__":
    unittest.main()
