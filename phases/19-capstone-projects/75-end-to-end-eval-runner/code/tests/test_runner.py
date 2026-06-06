"""Tests for the end-to-end eval runner."""

from __future__ import annotations

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BiasedAdapter,
    EvalReport,
    Generation,
    ModelAdapter,
    NoisyAdapter,
    RuleBasedAdapter,
    TaskResult,
    _correct_from_score,
    _load_fixture_tasks,
    build_eval_runs,
    render_markdown_block,
    render_report,
    run_eval,
)


class StubAdapter(ModelAdapter):
    model_id = "stub"

    def __init__(self, text_func) -> None:
        self.text_func = text_func
        self.token_stats: list[tuple[float, int]] = []
        self.calls = 0

    def generate(self, prompt, task):
        self.calls += 1
        text = self.text_func(task)
        token_count = max(1, len(text.split()))
        nll = token_count * 1.5
        self.token_stats.append((nll, token_count))
        return Generation(text=text, confidence=0.7, token_nll=nll, token_count=token_count)


def fixture_tasks():
    return _load_fixture_tasks()


class TestAdapterInterface(unittest.TestCase):
    def test_abstract_raises(self) -> None:
        with self.assertRaises(NotImplementedError):
            ModelAdapter().generate("p", None)

    def test_rule_based_always_correct_on_targets(self) -> None:
        tasks = fixture_tasks()
        adapter = RuleBasedAdapter()
        results, _ = run_eval([adapter], tasks, parallel=False)
        for r in results:
            if r.metric_name in ("exact_match", "accuracy"):
                self.assertTrue(r.correct, f"task {r.task_id} expected correct")


class TestRunEval(unittest.TestCase):
    def test_no_tasks_returns_empty(self) -> None:
        results, buf = run_eval([RuleBasedAdapter()], [])
        self.assertEqual(results, [])
        self.assertEqual(buf, {"rule_based": []})

    def test_no_adapters_returns_empty(self) -> None:
        tasks = fixture_tasks()
        results, buf = run_eval([], tasks)
        self.assertEqual(results, [])
        self.assertEqual(buf, {})

    def test_parallel_sequential_match(self) -> None:
        tasks = fixture_tasks()
        adapter_a = RuleBasedAdapter()
        adapter_b = RuleBasedAdapter()
        res_seq, _ = run_eval([adapter_a], tasks, parallel=False)
        res_par, _ = run_eval([adapter_b], tasks, parallel=True, max_workers=4)
        seq_scores = {r.task_id: r.score for r in res_seq}
        par_scores = {r.task_id: r.score for r in res_par}
        self.assertEqual(seq_scores, par_scores)

    def test_calibration_buf_populated(self) -> None:
        tasks = fixture_tasks()
        results, buf = run_eval([RuleBasedAdapter()], tasks, parallel=False)
        self.assertEqual(len(buf["rule_based"]), len(tasks))
        for entry in buf["rule_based"]:
            self.assertEqual(len(entry), 3)
            self.assertGreaterEqual(entry[0], 0.0)
            self.assertLessEqual(entry[0], 1.0)


class TestScoring(unittest.TestCase):
    def test_correct_threshold(self) -> None:
        self.assertTrue(_correct_from_score("exact_match", 1.0))
        self.assertFalse(_correct_from_score("exact_match", 0.99))
        self.assertTrue(_correct_from_score("f1", 0.6))
        self.assertFalse(_correct_from_score("f1", 0.49))
        self.assertTrue(_correct_from_score("code_exec", 1.0))

    def test_build_eval_runs(self) -> None:
        results = [
            TaskResult("m", "t1", "arithmetic", "exact_match", 1.0, True, 0.9, "yes"),
            TaskResult("m", "t2", "summary", "rouge_l", 0.6, True, 0.7, "ok"),
        ]
        runs = build_eval_runs(results)
        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].score, 1.0)


class TestReport(unittest.TestCase):
    def test_report_envelope(self) -> None:
        tasks = fixture_tasks()
        adapters = [RuleBasedAdapter(), NoisyAdapter(seed=2)]
        results, buf = run_eval(adapters, tasks, parallel=False)
        token_stats = {a.model_id: list(a.token_stats) for a in adapters}
        report = render_report(adapters, tasks, results, buf, token_stats, wall_seconds=0.1)
        self.assertIsInstance(report, EvalReport)
        payload = json.loads(report.to_json())
        for key in ("leaderboard", "pairwise", "calibration", "perplexity", "summary"):
            self.assertIn(key, payload)
        self.assertEqual(payload["summary"]["tasks"], len(tasks))
        self.assertEqual(payload["summary"]["models"], 2)
        self.assertIn("rule_based", payload["calibration"])

    def test_markdown_contains_models(self) -> None:
        tasks = fixture_tasks()
        adapters = [RuleBasedAdapter()]
        results, buf = run_eval(adapters, tasks, parallel=False)
        token_stats = {a.model_id: list(a.token_stats) for a in adapters}
        report = render_report(adapters, tasks, results, buf, token_stats, wall_seconds=0.1)
        md = render_markdown_block(report)
        self.assertIn("Rank", md)
        self.assertIn("rule_based", md)


class TestRanking(unittest.TestCase):
    def test_rule_based_beats_noisy(self) -> None:
        tasks = fixture_tasks()
        adapters = [RuleBasedAdapter(), NoisyAdapter(seed=3)]
        results, buf = run_eval(adapters, tasks, parallel=False)
        token_stats = {a.model_id: list(a.token_stats) for a in adapters}
        report = render_report(adapters, tasks, results, buf, token_stats, wall_seconds=0.1)
        self.assertEqual(report.leaderboard[0]["model_id"], "rule_based")

    def test_biased_strong_on_good_category(self) -> None:
        tasks = fixture_tasks()
        adapter = BiasedAdapter(good_category="arithmetic")
        results, _ = run_eval([adapter], tasks, parallel=False)
        arith_scores = [r.score for r in results if r.category == "arithmetic"]
        other_scores = [r.score for r in results if r.category != "arithmetic"]
        if arith_scores and other_scores:
            self.assertGreater(sum(arith_scores) / len(arith_scores),
                               sum(other_scores) / len(other_scores))


if __name__ == "__main__":
    unittest.main()
