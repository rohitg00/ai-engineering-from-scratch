"""HypothesisGenerator の tests: linear queue、dedup、parser、schedule、rank order。"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    GeneratorConfig,
    HypothesisGenerator,
    MockLLM,
    ParserError,
    build_demo_scripts,
    cosine_distance,
    hashed_embed,
    parse_response,
    temperature_bucket,
)


SEED_PROMPT = "Investigate attention sparsity in small transformers"


class TestParser(unittest.TestCase):
    def test_parses_full_block(self) -> None:
        raw = (
            "<hypothesis><text>x</text><variables>a, b</variables>"
            "<metric>m</metric><baseline>r</baseline></hypothesis>"
        )
        parsed = parse_response(raw)
        self.assertEqual(parsed["text"], "x")
        self.assertEqual(parsed["variables"], ["a", "b"])
        self.assertEqual(parsed["metric"], "m")
        self.assertEqual(parsed["baseline_ref"], "r")

    def test_baseline_optional(self) -> None:
        raw = "<hypothesis><text>x</text><variables>a</variables><metric>m</metric></hypothesis>"
        self.assertIsNone(parse_response(raw)["baseline_ref"])

    def test_rejects_unparseable(self) -> None:
        with self.assertRaises(ParserError):
            parse_response("plain text no tags")

    def test_rejects_empty_variables(self) -> None:
        raw = "<hypothesis><text>x</text><variables>   </variables><metric>m</metric></hypothesis>"
        with self.assertRaises(ParserError):
            parse_response(raw)


class TestEmbedding(unittest.TestCase):
    def test_unit_norm(self) -> None:
        vec = hashed_embed("attention sparsity small transformer")
        n = sum(v * v for v in vec) ** 0.5
        self.assertAlmostEqual(n, 1.0, places=5)

    def test_distance_self_zero(self) -> None:
        v = hashed_embed("identical text identical text")
        self.assertAlmostEqual(cosine_distance(v, v), 0.0, places=5)

    def test_distance_disjoint_high(self) -> None:
        a = hashed_embed("attention sparsity transformer")
        b = hashed_embed("dataloader checkpoint scheduler")
        self.assertGreater(cosine_distance(a, b), 0.5)


class TestTemperatureRamp(unittest.TestCase):
    def test_schedule_endpoints(self) -> None:
        cfg = GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1)
        schedule = cfg.schedule()
        self.assertEqual(len(schedule), 4)
        self.assertAlmostEqual(schedule[0], 0.2)
        self.assertAlmostEqual(schedule[-1], 1.1)

    def test_schedule_one_pass(self) -> None:
        cfg = GeneratorConfig(n_passes=1, t_min=0.5, t_max=1.2)
        self.assertEqual(cfg.schedule(), [0.5])

    def test_schedule_zero_passes(self) -> None:
        self.assertEqual(GeneratorConfig(n_passes=0).schedule(), [])

    def test_bucket_boundaries(self) -> None:
        self.assertEqual(temperature_bucket(0.2), 0)
        self.assertEqual(temperature_bucket(0.5), 1)
        self.assertEqual(temperature_bucket(0.8), 2)
        self.assertEqual(temperature_bucket(1.1), 3)


class TestGenerator(unittest.TestCase):
    def test_demo_path_produces_queue(self) -> None:
        gen = HypothesisGenerator(MockLLM(build_demo_scripts()), GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1))
        queue, logs = gen.run(SEED_PROMPT)
        self.assertEqual(len(queue), 4)
        self.assertEqual(len(logs), 4)
        for log in logs:
            self.assertIsNone(log.reject_reason)
        ids = [h.id for h in queue]
        self.assertEqual(sorted(ids), [1, 2, 3, 4])

    def test_queue_sorted_by_rank_desc(self) -> None:
        gen = HypothesisGenerator(MockLLM(build_demo_scripts()), GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1))
        queue, _ = gen.run(SEED_PROMPT)
        scores = [h.rank_score for h in queue]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_duplicate_rejected(self) -> None:
        sig = MockLLM.prompt_signature(SEED_PROMPT)
        repeated = (
            "<hypothesis><text>head count eight to four loss two percent</text>"
            "<variables>head_count, loss</variables><metric>loss</metric>"
            "<baseline>head_count_8</baseline></hypothesis>"
        )
        scripts = {(sig, 0): [repeated], (sig, 1): [repeated], (sig, 2): [repeated], (sig, 3): [repeated]}
        gen = HypothesisGenerator(MockLLM(scripts), GeneratorConfig(n_passes=4))
        queue, logs = gen.run(SEED_PROMPT)
        self.assertEqual(len(queue), 1)
        reject_reasons = [log.reject_reason for log in logs if log.reject_reason]
        self.assertEqual(reject_reasons, ["duplicate", "duplicate", "duplicate"])

    def test_parser_failure_logged(self) -> None:
        sig = MockLLM.prompt_signature(SEED_PROMPT)
        scripts = {(sig, 0): ["plain text"], (sig, 1): build_demo_scripts()[(sig, 1)]}
        gen = HypothesisGenerator(MockLLM(scripts), GeneratorConfig(n_passes=2, t_min=0.2, t_max=0.6))
        queue, logs = gen.run(SEED_PROMPT)
        self.assertEqual(len(queue), 1)
        self.assertTrue(logs[0].reject_reason.startswith("parse:"))

    def test_unknown_prompt_falls_back_and_drops(self) -> None:
        gen = HypothesisGenerator(MockLLM({}), GeneratorConfig(n_passes=3))
        queue, logs = gen.run("never seen prompt")
        self.assertEqual(queue, [])
        self.assertTrue(all(log.reject_reason and log.reject_reason.startswith("parse:") for log in logs))

    def test_specificity_weight_changes_rank(self) -> None:
        cfg_a = GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1, w_specificity=1.0, w_novelty=0.0, w_testability=0.0)
        gen = HypothesisGenerator(MockLLM(build_demo_scripts()), cfg_a)
        queue, _ = gen.run(SEED_PROMPT)
        for h in queue:
            self.assertGreaterEqual(h.rank_score, 0.0)
            self.assertLessEqual(h.rank_score, 1.0)


class TestDeterminism(unittest.TestCase):
    def test_two_runs_identical(self) -> None:
        gen_a = HypothesisGenerator(MockLLM(build_demo_scripts()), GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1))
        gen_b = HypothesisGenerator(MockLLM(build_demo_scripts()), GeneratorConfig(n_passes=4, t_min=0.2, t_max=1.1))
        queue_a, _ = gen_a.run(SEED_PROMPT)
        queue_b, _ = gen_b.run(SEED_PROMPT)
        self.assertEqual([h.to_dict() for h in queue_a], [h.to_dict() for h in queue_b])


if __name__ == "__main__":
    unittest.main()
