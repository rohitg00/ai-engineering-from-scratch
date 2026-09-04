"""Tests for the end-to-end auto-research demo: composition, determinism, failure modes."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BestResultError,
    DemoReport,
    NoTriggerError,
    PaperValidationError,
    SchedulerReport,
    build_mini_paper,
    make_seed_hypotheses,
    mini_to_full_paper,
    pick_best_branch,
    run_demo,
)
import main as e2e  # noqa: E402


class TestComposition(unittest.TestCase):
    def test_demo_runs_to_completion(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            rep = run_demo(out_dir=td)
            self.assertIsInstance(rep, DemoReport)
            self.assertTrue(rep.best_branch)
            self.assertGreater(rep.best_reward, 0.0)
            self.assertEqual(rep.critic_result["status"], "converged")
            self.assertGreaterEqual(rep.scheduler_report["experiments_run"], 3)
            self.assertGreaterEqual(len(rep.paper_manifest["sections"]), 2)
            self.assertGreaterEqual(len(rep.paper_manifest["figures"]), 1)

    def test_paper_files_emitted(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            rep = run_demo(out_dir=td)
            tex = rep.paper_manifest["tex_path"]
            bib = rep.paper_manifest["bib_path"]
            self.assertTrue(os.path.exists(tex))
            self.assertTrue(os.path.exists(bib))


class TestDeterminism(unittest.TestCase):
    def test_two_runs_with_same_seed_produce_same_branch(self) -> None:
        with tempfile.TemporaryDirectory() as td1, tempfile.TemporaryDirectory() as td2:
            r1 = run_demo(out_dir=td1, seed=11)
            r2 = run_demo(out_dir=td2, seed=11)
        self.assertEqual(r1.best_branch, r2.best_branch)
        self.assertAlmostEqual(r1.best_reward, r2.best_reward, places=6)
        self.assertEqual(
            [s["id"] for s in r1.paper_manifest["sections"]],
            [s["id"] for s in r2.paper_manifest["sections"]],
        )


class TestPicker(unittest.TestCase):
    def test_no_trigger_raises(self) -> None:
        rep = SchedulerReport(
            stop_reason="queue_empty", experiments_run=3, wall_seconds=0.01,
            branches=[], paper_triggers=[], trace=[],
        )
        with self.assertRaises(NoTriggerError):
            pick_best_branch(rep)

    def test_orphan_trigger_raises_best_result_error(self) -> None:
        rep = SchedulerReport(
            stop_reason="queue_empty", experiments_run=3, wall_seconds=0.01,
            branches=[], paper_triggers=["ghost"], trace=[],
        )
        with self.assertRaises(BestResultError):
            pick_best_branch(rep)

    def test_ties_break_alphabetically(self) -> None:
        from main import scheduler_mod
        BranchStats = scheduler_mod.BranchStats
        rep = SchedulerReport(
            stop_reason="queue_empty", experiments_run=2, wall_seconds=0.01,
            branches=[
                BranchStats(branch="beta", runs=2, reward_sum=1.6),
                BranchStats(branch="alpha", runs=2, reward_sum=1.6),
            ],
            paper_triggers=["beta", "alpha"], trace=[],
        )
        branch, _ = pick_best_branch(rep)
        self.assertEqual(branch, "alpha")


class TestPaperWriterContract(unittest.TestCase):
    def test_validation_error_propagates(self) -> None:
        mini = build_mini_paper("alpha", 0.9)
        full = mini_to_full_paper(mini, "alpha")
        full.title = ""
        from main import MockProseGenerator, PaperWriter
        writer = PaperWriter(prose=MockProseGenerator(outlines={}))
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(PaperValidationError):
                writer.write(full, td)


class TestSeedAndScheduler(unittest.TestCase):
    def test_seed_has_three_branches(self) -> None:
        seed = make_seed_hypotheses()
        self.assertEqual(len(seed), 3)
        self.assertEqual(len({h.branch for h in seed}), 3)

    def test_demo_stop_reason_is_known(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            rep = run_demo(out_dir=td)
        self.assertIn(
            rep.stop_reason,
            {"queue_empty", "max_experiments", "deadline"},
        )


class TestPicker_BestBranchIsAlpha(unittest.TestCase):
    def test_alpha_wins_under_default_seed(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            rep = run_demo(out_dir=td, seed=11)
        self.assertEqual(rep.best_branch, "alpha")
        self.assertGreater(rep.best_reward, 0.7)


if __name__ == "__main__":
    unittest.main()
