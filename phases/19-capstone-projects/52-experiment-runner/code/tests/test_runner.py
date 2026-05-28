"""ExperimentRunner の tests: ok path、timeout、crash、ablation、determinism。"""

from __future__ import annotations

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    AblationRunner,
    ExperimentResult,
    ExperimentRunner,
    ExperimentSpec,
    _scan_intermediates,
    ablate,
)


CODE_ROOT = os.path.dirname(HERE)
SCRIPT_OK = os.path.join(CODE_ROOT, "experiments", "sparsity_experiment.py")
SCRIPT_CRASH = os.path.join(CODE_ROOT, "experiments", "crashing_experiment.py")


def make_spec(**overrides) -> ExperimentSpec:
    base = ExperimentSpec(
        spec_id=overrides.pop("spec_id", "test"),
        hypothesis_id=overrides.pop("hypothesis_id", 1),
        script_path=overrides.pop("script_path", SCRIPT_OK),
        config=overrides.pop("config", {"k": 8, "steps": 3, "sleep_s": 0.0}),
        seed=overrides.pop("seed", 7),
        wall_timeout_s=overrides.pop("wall_timeout_s", 15.0),
        memory_cap_mb=overrides.pop("memory_cap_mb", 256),
        metric_keys=overrides.pop("metric_keys", ["perplexity", "final_loss"]),
    )
    return base


class TestScanIntermediates(unittest.TestCase):
    def test_picks_last_covering_line(self) -> None:
        stdout = "noise\n{\"step\":0,\"perplexity\":1.0,\"final_loss\":0.5}\n{\"perplexity\":0.9,\"final_loss\":0.4}\n"
        final, intermediates = _scan_intermediates(stdout, ["perplexity", "final_loss"])
        self.assertEqual(final["perplexity"], 0.9)
        self.assertEqual(len(intermediates), 1)
        self.assertEqual(intermediates[0]["step"], 0)

    def test_ignores_lines_missing_keys(self) -> None:
        stdout = "{\"step\":0,\"only\":1}\n{\"perplexity\":0.7,\"final_loss\":0.3}\n"
        final, intermediates = _scan_intermediates(stdout, ["perplexity", "final_loss"])
        self.assertEqual(final["perplexity"], 0.7)
        self.assertEqual(intermediates, [])

    def test_no_required_keys_takes_last_json(self) -> None:
        stdout = "{\"a\":1}\n{\"a\":2}\n"
        final, _ = _scan_intermediates(stdout, [])
        self.assertEqual(final, {"a": 2})


class TestRunnerOk(unittest.TestCase):
    def test_success_returns_metrics(self) -> None:
        runner = ExperimentRunner()
        result = runner.run(make_spec())
        self.assertEqual(result.terminal, "ok")
        self.assertEqual(result.exit_code, 0)
        self.assertIn("perplexity", result.metrics)
        self.assertIn("final_loss", result.metrics)
        self.assertGreater(result.metrics["perplexity"], 0.0)

    def test_intermediate_metrics_captured(self) -> None:
        runner = ExperimentRunner()
        result = runner.run(make_spec(config={"k": 8, "steps": 4, "sleep_s": 0.0}))
        self.assertEqual(len(result.intermediate_metrics), 4)
        steps = [m["step"] for m in result.intermediate_metrics]
        self.assertEqual(steps, [0, 1, 2, 3])

    def test_seed_forwarded(self) -> None:
        runner = ExperimentRunner()
        result = runner.run(make_spec(seed=42))
        self.assertEqual(result.metrics["seed"], 42)


class TestRunnerTimeout(unittest.TestCase):
    def test_timeout_terminal(self) -> None:
        runner = ExperimentRunner()
        spec = make_spec(
            spec_id="timeout_case",
            config={"k": 8, "steps": 20, "sleep_s": 0.4},
            wall_timeout_s=0.5,
        )
        result = runner.run(spec)
        self.assertEqual(result.terminal, "timeout")


class TestRunnerCrash(unittest.TestCase):
    def test_non_zero_exit_is_crash(self) -> None:
        runner = ExperimentRunner()
        spec = make_spec(script_path=SCRIPT_CRASH, metric_keys=["perplexity"])
        result = runner.run(spec)
        self.assertEqual(result.terminal, "crash")
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("simulated failure", result.stderr_tail)


class TestAblate(unittest.TestCase):
    def test_ablate_creates_one_spec_per_value(self) -> None:
        base = make_spec()
        specs = ablate(base, "k", [4, 8, 16])
        self.assertEqual(len(specs), 3)
        ids = [s.spec_id for s in specs]
        self.assertEqual(ids, ["test_k_4", "test_k_8", "test_k_16"])
        for spec, value in zip(specs, [4, 8, 16]):
            self.assertEqual(spec.config["k"], value)

    def test_ablation_sweep_returns_table(self) -> None:
        runner = AblationRunner(ExperimentRunner())
        table = runner.sweep(make_spec(), "k", [4, 8])
        self.assertEqual(table.knob, "k")
        self.assertEqual(len(table.rows), 2)
        for value, result in table.rows:
            self.assertEqual(result.terminal, "ok")
            self.assertEqual(result.metrics["k"], value)


class TestDeterminism(unittest.TestCase):
    def test_two_runs_same_seed_match(self) -> None:
        runner = ExperimentRunner()
        a = runner.run(make_spec(seed=11))
        b = runner.run(make_spec(seed=11))
        self.assertEqual(a.metrics["perplexity"], b.metrics["perplexity"])
        self.assertEqual(a.metrics["final_loss"], b.metrics["final_loss"])


if __name__ == "__main__":
    unittest.main()
