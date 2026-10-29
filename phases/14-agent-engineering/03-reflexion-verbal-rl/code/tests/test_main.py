import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main
from main import (AdversarialActor, EpisodicMemory, Reflection, build_prompt,
                  run_adversarial, run_reflexion)


def memory_with(*attempts):
    memory = EpisodicMemory()
    for i, attempt in enumerate(attempts, 1):
        memory.add(Reflection(i, f"sum {sum(attempt)} is {main.TARGET - sum(attempt)} short", attempt))
    return memory


class ReflexionLoopTests(unittest.TestCase):
    def test_no_memory_never_converges(self):
        trials = run_reflexion(12, use_memory=False, evaluator="binary")
        self.assertFalse(trials[-1].success)
        self.assertEqual({tuple(t.attempt) for t in trials}, {(1, 2, 3)})

    def test_scalar_converges_with_memory(self):
        trials = run_reflexion(12, use_memory=True, evaluator="scalar")
        self.assertTrue(trials[-1].success)
        self.assertLessEqual(len(trials), 3)


class AdversarialActorTests(unittest.TestCase):
    def test_ignores_reflections_without_forbidden_list(self):
        memory = memory_with([1, 2, 3], [2, 2, 3])
        for level in (0, 1, 2):
            self.assertEqual(AdversarialActor().act(build_prompt(level, memory)), [1, 2, 3])

    def test_forbidden_list_blocks_repeats(self):
        memory = memory_with([1, 2, 3], [1, 2, 4])
        guess = AdversarialActor().act(build_prompt(3, memory))
        self.assertNotIn(guess, [[1, 2, 3], [1, 2, 4]])

    def test_prompt_levels_add_features(self):
        memory = memory_with([1, 2, 3])
        self.assertTrue(build_prompt(0, memory).endswith("Pick three integers in 1..9 that sum to 20."))
        self.assertTrue(build_prompt(1, memory).endswith("Answer:"))
        self.assertIn("FAILED", build_prompt(2, memory))
        self.assertIn("FORBIDDEN", build_prompt(3, memory))
        self.assertNotIn("FORBIDDEN", build_prompt(2, memory))

    def test_weak_prompt_levels_never_converge(self):
        for level in (0, 1, 2):
            for evaluator in ("binary", "scalar"):
                self.assertIsNone(run_adversarial(level, evaluator, max_trials=30))

    def test_forbidden_list_converges_and_scalar_is_faster(self):
        binary = run_adversarial(3, "binary")
        scalar = run_adversarial(3, "scalar")
        self.assertIsNotNone(binary)
        self.assertIsNotNone(scalar)
        self.assertLess(scalar, binary)


if __name__ == "__main__":
    unittest.main()
