import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class McpaExamStrategyTests(unittest.TestCase):
    def test_domain_weights_sum_to_100(self) -> None:
        self.assertEqual(sum(main.DOMAIN_WEIGHTS.values()), 100)
        main.validate_weights(main.DOMAIN_WEIGHTS)

    def test_invalid_weights_raise_value_error(self) -> None:
        bad_weights = {"mcp-fundamentals": 50, "architecture-and-components": 40}
        with self.assertRaises(ValueError):
            main.validate_weights(bad_weights)
        with self.assertRaises(ValueError):
            main.allocate_study_hours(10.0, weights=bad_weights)

    def test_allocation_is_proportional_and_sums_to_budget(self) -> None:
        total_hours = 50.0
        allocation = main.allocate_study_hours(total_hours)
        self.assertEqual(set(allocation), set(main.DOMAIN_WEIGHTS))
        self.assertAlmostEqual(sum(allocation.values()), total_hours, places=6)
        for domain, weight in main.DOMAIN_WEIGHTS.items():
            self.assertAlmostEqual(allocation[domain], total_hours * weight / 100, places=6)

    def test_zero_budget_allocates_zero_to_every_domain(self) -> None:
        allocation = main.allocate_study_hours(0.0)
        self.assertTrue(all(hours == 0.0 for hours in allocation.values()))
        self.assertEqual(set(allocation), set(main.DOMAIN_WEIGHTS))

    def test_negative_hours_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            main.allocate_study_hours(-5.0)

    def test_readiness_estimate_weights_domains_correctly(self) -> None:
        heavy_domain_only = {"interactions-and-execution": (10, 10)}
        light_domain_only = {"architecture-and-components": (10, 10)}
        heavy_score = main.estimate_readiness(heavy_domain_only)
        light_score = main.estimate_readiness(light_domain_only)
        self.assertEqual(heavy_score, 26.0)
        self.assertEqual(light_score, 14.0)
        self.assertGreater(heavy_score, light_score)

    def test_perfect_scores_in_every_domain_give_full_readiness(self) -> None:
        results = {domain: (10, 10) for domain in main.DOMAIN_WEIGHTS}
        self.assertEqual(main.estimate_readiness(results), 100.0)

    def test_domain_with_zero_total_handled_without_division_error(self) -> None:
        results = {domain: (0, 0) for domain in main.DOMAIN_WEIGHTS}
        readiness = main.estimate_readiness(results)
        self.assertEqual(readiness, 0.0)

    def test_missing_domain_in_results_defaults_to_zero(self) -> None:
        partial_results = {"security-and-governance": (10, 10)}
        readiness = main.estimate_readiness(partial_results)
        self.assertEqual(readiness, 24.0)

    def test_unknown_domain_in_results_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            main.estimate_readiness({"not-a-real-domain": (5, 5)})

    def test_unknown_domain_is_rejected_by_route_lookup(self) -> None:
        with self.assertRaises(ValueError):
            main.route_for_domain("not-a-real-domain")

    def test_route_covers_all_34_lessons(self) -> None:
        main.validate_route()
        self.assertEqual(len(main.ROUTE), 34)
        self.assertEqual({entry["nn"] for entry in main.ROUTE}, {f"{n:02d}" for n in range(34)})

    def test_route_for_domain_includes_this_lesson(self) -> None:
        self.assertIn("mcp-exam-strategy", main.route_for_domain("mcp-fundamentals"))

    def test_capstone_lesson_spans_every_domain(self) -> None:
        capstone = main.ROUTE[-1]
        self.assertEqual(capstone["nn"], "33")
        self.assertEqual(set(capstone["domains"]), set(main.DOMAIN_WEIGHTS))


if __name__ == "__main__":
    unittest.main()
