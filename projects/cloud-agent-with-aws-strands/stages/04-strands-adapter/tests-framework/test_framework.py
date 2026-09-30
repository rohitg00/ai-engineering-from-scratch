import unittest
from strands_adapter import run_strands, parse_model_plan


class FrameworkTests(unittest.TestCase):
    def test_real_agent_runs_fake_stream(self):
        self.assertEqual(run_strands("inspect", "hello")["text"], "hello")

    def test_exactly_one_model_turn(self):
        self.assertEqual(run_strands("inspect", "hello")["model_calls"], 1)

    def test_result_passes_independent_scope_gate(self):
        result = run_strands("inspect", '[{"operation":"logs.read","resource":"svc"}]')
        self.assertEqual(
            parse_model_plan(result["text"], {"svc"})[0]["resource"], "svc"
        )

    def test_invalid_model_plan_is_still_rejected(self):
        result = run_strands("inspect", '[{"operation":"delete","resource":"svc"}]')
        with self.assertRaises(ValueError):
            parse_model_plan(result["text"], {"svc"})

    def test_model_is_fresh_per_run(self):
        self.assertEqual(run_strands("a", "one")["text"], "one")
        self.assertEqual(run_strands("b", "two")["text"], "two")
