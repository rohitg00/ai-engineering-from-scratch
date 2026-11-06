#!/usr/bin/env python3
"""Regression tests for the quiz length-bias gate.

The gate runs on every contributor machine, so it has to read the phase name out
of a glob result regardless of the platform's path separator.
"""

import contextlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_quiz_bias as bias


@contextlib.contextmanager
def course_root():
    with tempfile.TemporaryDirectory() as root:
        previous = os.getcwd()
        os.chdir(root)
        try:
            yield Path(root)
        finally:
            os.chdir(previous)


def write_quiz(phase, lesson, correct, options):
    directory = Path("phases") / phase / lesson
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "quiz.json").write_text(
        json.dumps({"questions": [{"question": "q", "options": options, "correct": correct}]}),
        encoding="utf-8",
    )


def windows_path(relative):
    return str(relative).replace("/", "\\")


class PathSeparatorTests(unittest.TestCase):
    def test_scan_reads_the_phase_from_a_windows_glob_result(self):
        with course_root():
            write_quiz("01-basics", "01-intro", 0, ["a", "b", "c", "d"])
            globbed = [windows_path("phases/01-basics/01-intro/quiz.json")]
            with patch.object(bias.glob, "glob", return_value=globbed):
                total, biased, per_phase, offenders, errors = bias.scan()

        self.assertEqual(errors, [])
        self.assertEqual(total, 1)
        self.assertEqual(biased, 0)
        self.assertEqual(dict(per_phase), {"01-basics": [0, 1]})
        self.assertEqual(offenders, [])

    def test_scan_reports_offenders_by_a_readable_path_on_windows(self):
        with course_root():
            write_quiz("01-basics", "01-intro", 0, ["a much longer correct answer", "b", "c", "d"])
            globbed = [windows_path("phases/01-basics/01-intro/quiz.json")]
            with patch.object(bias.glob, "glob", return_value=globbed):
                _, biased, _, offenders, errors = bias.scan()

        self.assertEqual(errors, [])
        self.assertEqual(biased, 1)
        self.assertEqual(offenders[0][0], "phases/01-basics/01-intro/quiz.json")

    def test_an_unreadable_quiz_is_reported_rather_than_raising(self):
        with course_root():
            globbed = [windows_path("phases/01-basics/01-intro/quiz.json")]
            with patch.object(bias.glob, "glob", return_value=globbed):
                _, _, _, _, errors = bias.scan()

        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0][0], "phases/01-basics/01-intro/quiz.json")

    def test_a_posix_glob_result_is_unaffected(self):
        with course_root():
            write_quiz("01-basics", "01-intro", 0, ["a", "b", "c", "d"])
            with patch.object(bias.glob, "glob", return_value=["phases/01-basics/01-intro/quiz.json"]):
                total, _, per_phase, _, errors = bias.scan()

        self.assertEqual(errors, [])
        self.assertEqual(total, 1)
        self.assertEqual(dict(per_phase), {"01-basics": [0, 1]})


class LengthBiasTests(unittest.TestCase):
    def test_a_correct_answer_far_longer_than_every_distractor_is_biased(self):
        question = {"options": ["a", "b", "c", "a much longer correct answer"], "correct": 3}
        self.assertTrue(bias.is_length_biased(question))

    def test_comparable_lengths_are_not_biased(self):
        question = {
            "options": ["overfitting", "mini-batch gradient descent", "stochastic gradient descent", "dropout"],
            "correct": 2,
        }
        self.assertFalse(bias.is_length_biased(question))

    def test_a_malformed_question_is_skipped(self):
        self.assertIsNone(bias.is_length_biased({"options": ["only one"], "correct": 0}))
        self.assertIsNone(bias.is_length_biased({"options": ["a", "b"], "correct": 7}))
        self.assertIsNone(bias.is_length_biased({"options": ["a", "b"], "correct": "0"}))


if __name__ == "__main__":
    unittest.main()
