"""Unit tests for pipeline scheduling and the 2-stage gloo wire."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

from main import (  # noqa: E402
    bubble_fraction,
    gpipe_schedule,
    measure_bubble,
    render_gantt,
    run_pipeline,
)


class TestPipeline(unittest.TestCase):
    def test_closed_form_matches_measured_bubble(self):
        for n in (2, 3, 4):
            for m in (4, 8, 16):
                closed = bubble_fraction(n, m)
                measured = measure_bubble(n, m)
                self.assertAlmostEqual(closed, measured, places=4,
                                       msg=f"N={n}, M={m}: closed={closed} measured={measured}")

    def test_bubble_shrinks_with_more_microbatches(self):
        b1 = bubble_fraction(4, 1)
        b16 = bubble_fraction(4, 16)
        b64 = bubble_fraction(4, 64)
        self.assertGreater(b1, b16)
        self.assertGreater(b16, b64)

    def test_schedule_covers_every_microbatch_through_every_stage(self):
        n, m = 4, 8
        schedule = gpipe_schedule(n, m)
        forwards = [(s, mb) for c, s, mb, phase in schedule if phase == "F"]
        backwards = [(s, mb) for c, s, mb, phase in schedule if phase == "B"]
        self.assertEqual(len(forwards), n * m)
        self.assertEqual(len(backwards), n * m)
        self.assertEqual(set(forwards), {(s, mb) for s in range(n) for mb in range(m)})

    def test_render_gantt_includes_every_stage(self):
        out = render_gantt(gpipe_schedule(4, 4), 4, 4)
        for s in range(4):
            self.assertIn(f"stage {s}", out)

    def test_two_rank_real_pipeline_runs(self):
        results = run_pipeline(steps=2, batch=4, microbatches=3)
        self.assertIn(0, results)
        self.assertIn(1, results)
        rank1_losses = results[1][0]
        self.assertEqual(len(rank1_losses), 2 * 3)

    def test_bubble_is_zero_when_one_stage(self):
        self.assertEqual(bubble_fraction(1, 8), 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
