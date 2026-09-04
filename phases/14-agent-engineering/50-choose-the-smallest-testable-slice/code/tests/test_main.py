import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson50", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class SliceDecisionTests(unittest.TestCase):
    def test_read_only_replay_wins(self):
        selected = module.choose(module.example(), {"service-identification", "operator-trust"})
        self.assertEqual(selected.name, "read-only incident replay")

    def test_slice_must_cover_required_proof(self):
        with self.assertRaisesRegex(ValueError, "no slice"):
            module.choose(module.example(), {"billing"})

    def test_zero_effort_is_invalid(self):
        item = module.Slice("x", 1, 1, 0, 1, True, ())
        with self.assertRaises(ValueError):
            module.score(item)

    def test_irreversible_consequence_reduces_score(self):
        reversible = module.Slice("a", 5, 5, 2, 4, True, ())
        irreversible = module.Slice("b", 5, 5, 2, 4, False, ())
        self.assertGreater(module.score(reversible), module.score(irreversible))

    def test_decision_records_alternatives(self):
        result = module.decision(module.example(), {"operator-trust"})
        self.assertEqual(len(result["alternatives"]), 2)


if __name__ == "__main__":
    unittest.main()
