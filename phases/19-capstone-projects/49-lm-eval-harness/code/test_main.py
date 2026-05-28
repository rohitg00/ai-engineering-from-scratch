"""eval harness の tests: metric scoring、task loading、runner。"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import main as harness


class MetricTests(unittest.TestCase):
    def test_exact_match_normalizes_case_and_whitespace(self):
        self.assertEqual(harness.metric_exact_match("  こんにちは  世界 ", ["こんにちは 世界"]), 1.0)
        self.assertEqual(harness.metric_exact_match("さようなら", ["こんにちは"]), 0.0)

    def test_multiple_choice_uses_first_letter(self):
        self.assertEqual(harness.metric_multiple_choice("a) りんご", ["A"]), 1.0)
        self.assertEqual(harness.metric_multiple_choice("B", ["A"]), 0.0)

    def test_rouge_l_returns_perfect_on_identical_strings(self):
        score = harness.metric_rouge_l("川 は 東へ 流れる", ["川 は 東へ 流れる"])
        self.assertAlmostEqual(score, 1.0, places=6)

    def test_rouge_l_partial_overlap_below_one(self):
        score = harness.metric_rouge_l("川 は 東へ 流れる", ["川 は ゆっくり 曲がる"])
        self.assertGreater(score, 0.0)
        self.assertLess(score, 1.0)

    def test_substring_contains_truthy_when_target_inside(self):
        self.assertEqual(harness.metric_substring_contains("gradient は良い", ["gradient"]), 1.0)
        self.assertEqual(harness.metric_substring_contains("ここには一致がない", ["gradient"]), 0.0)

    def test_code_exec_runs_pairs_and_blocks_unsafe(self):
        prediction = "def f(x):\n    return x * 2\n"
        pairs = {"io_pairs": [[1, 2], [3, 6]]}
        self.assertEqual(harness.metric_code_exec(prediction, [], pairs), 1.0)
        bad = "import os\ndef f(x):\n    return os.getcwd()\n"
        self.assertEqual(harness.metric_code_exec(bad, [], {"io_pairs": [[1, "anything"]]}), 0.0)


class SafeArithTests(unittest.TestCase):
    def test_arith_eval_basic_ops(self):
        self.assertEqual(harness.safe_arith_eval("1 + 2 * 3"), 7)
        self.assertEqual(harness.safe_arith_eval("(8 - 2) / 3"), 2.0)

    def test_arith_eval_rejects_calls(self):
        with self.assertRaises(ValueError):
            harness.safe_arith_eval("__import__('os').system('echo')")


class TaskIOTests(unittest.TestCase):
    def test_round_trip_jsonl(self):
        with tempfile.TemporaryDirectory() as tmp:
            examples = harness.build_arithmetic_task()
            path = Path(tmp) / "arith.jsonl"
            harness.write_task_jsonl(examples, path)
            loaded = harness.load_task_jsonl(path)
            self.assertEqual(len(loaded), len(examples))
            self.assertEqual(loaded[0].metric, "exact_match")
            self.assertEqual(loaded[0].id, examples[0].id)

    def test_load_skips_comments_and_blanks(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "comments.jsonl"
            path.write_text("# comment\n\n{\"prompt\":\"compute: 1 + 1\",\"targets\":[\"2\"],\"metric\":\"exact_match\"}\n")
            loaded = harness.load_task_jsonl(path)
            self.assertEqual(len(loaded), 1)


class RunnerTests(unittest.TestCase):
    def test_runner_full_score_with_toy_adapter(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = harness.seed_fixture_tasks(Path(tmp))
            tasks = harness.load_all_tasks(Path(tmp))
            self.assertEqual(len(tasks), 5)
            adapter = harness.ToyAdapter()
            board = harness.run_leaderboard(tasks, adapter, batch_size=3)
            self.assertEqual(board.schema, "leaderboard.v1")
            self.assertEqual(len(board.tasks), 5)
            for r in board.tasks:
                self.assertEqual(r.total, 5)
                self.assertGreater(r.score, 0.5, msg=f"score が低すぎます: {r.task}: {r.score}")

    def test_runner_handles_mixed_failure(self):
        class StubAdapter:
            name = "stub"

            def generate(self, prompts):
                return ["" for _ in prompts]

        with tempfile.TemporaryDirectory() as tmp:
            paths = harness.seed_fixture_tasks(Path(tmp))
            tasks = harness.load_all_tasks(Path(tmp))
            board = harness.run_leaderboard(tasks, StubAdapter(), batch_size=2)
            self.assertEqual(len(board.tasks), 5)
            for r in board.tasks:
                self.assertEqual(r.score, 0.0)
            self.assertEqual(board.overall_score, 0.0)


class LeaderboardOutputTests(unittest.TestCase):
    def test_leaderboard_json_contains_schema(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = harness.seed_fixture_tasks(Path(tmp) / "tasks")
            tasks = harness.load_all_tasks(Path(tmp) / "tasks")
            adapter = harness.ToyAdapter()
            board = harness.run_leaderboard(tasks, adapter)
            out = Path(tmp) / "leaderboard.json"
            harness.write_leaderboard(board, out, adapter_name=adapter.name)
            payload = json.loads(out.read_text())
            self.assertEqual(payload["schema"], "leaderboard.v1")
            self.assertEqual(payload["adapter"], adapter.name)
            self.assertEqual(len(payload["tasks"]), 5)
            for entry in payload["tasks"]:
                self.assertNotIn("per_example", entry)
            harness.write_leaderboard(board, out, adapter_name=adapter.name, include_per_example=True)
            payload2 = json.loads(out.read_text())
            for entry in payload2["tasks"]:
                self.assertIn("per_example", entry)


if __name__ == "__main__":
    unittest.main()
