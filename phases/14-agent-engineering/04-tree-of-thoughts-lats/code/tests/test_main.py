"""Tests for main.py exercises (Phase 14, Lesson 04)."""

import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main as ex
from main import expand, value


class TestExercises(unittest.TestCase):
    def test_c_controls_visit_spread(self):
        rows = {r["c"]: r for r in ex.exercise_1(range(8))}
        self.assertLess(rows[0.1]["entropy_bits"], rows[2.0]["entropy_bits"])
        self.assertGreater(rows[0.1]["top_child_share"], rows[2.0]["top_child_share"])

    def test_zero_noise_matches_true_value(self):
        fn = ex.noisy(0.0, random.Random(0))
        leaf = expand(ex.make_root())[0]
        self.assertEqual(fn(leaf), value(leaf))

    def test_noise_degrades_search(self):
        rows = {r["sigma"]: r for r in ex.exercise_2(range(10))}
        self.assertGreater(rows[0.0]["solve_rate"], 0.7)
        self.assertLess(rows[1.0]["solve_rate"], rows[0.0]["solve_rate"])

    def test_budget_is_respected(self):
        _, spent = ex.tot_search(ex.make_root(), None, budget=100)
        self.assertLessEqual(spent, 100)

    def test_full_width_bfs_solves_given_budget(self):
        node, _ = ex.tot_search(ex.make_root(), None, budget=1200)
        self.assertGreater(value(node), 0.99)

    def test_narrow_beam_prunes_the_solution(self):
        node, _ = ex.tot_search(ex.make_root(), 2, budget=1200)
        self.assertLess(value(node), 0.99)

    def test_beam_spends_less_than_bfs(self):
        _, beam = ex.tot_search(ex.make_root(), 8, budget=1200)
        _, bfs = ex.tot_search(ex.make_root(), None, budget=1200)
        self.assertLess(beam, bfs)


if __name__ == "__main__":
    unittest.main()
