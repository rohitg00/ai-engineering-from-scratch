"""Deterministic tests for the chatbot architecture examples."""

from __future__ import annotations

import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ChatbotTests(unittest.TestCase):
    def test_rule_responses_are_case_insensitive_and_trim_whitespace(self) -> None:
        self.assertEqual(
            main.rule_based_respond("  MY NAME IS Ada  "),
            "Nice to meet you, Ada.",
        )

    def test_rule_responses_interpolate_each_captured_group(self) -> None:
        cases = {
            "I need help with billing": "Why do you need help with billing?",
            "I want coffee": "Why do you want coffee?",
            "I feel tired": "Why do you feel tired?",
        }
        for message, expected in cases.items():
            with self.subTest(message=message):
                self.assertEqual(main.rule_based_respond(message), expected)

    def test_rule_responses_use_greeting_and_catch_all_patterns(self) -> None:
        self.assertEqual(
            main.rule_based_respond("Hey there"),
            "Hello. How can I help?",
        )
        self.assertEqual(
            main.rule_based_respond("The sky is blue"),
            "Tell me more about that.",
        )

    def test_token_set_normalizes_case_punctuation_and_duplicates(self) -> None:
        self.assertEqual(
            main.token_set("Reset, RESET my Password! 123"),
            {"reset", "my", "password"},
        )

    def test_faq_exact_match_returns_answer_and_perfect_score(self) -> None:
        answer, score = main.faq_respond("HOW DO I RESET MY PASSWORD?")
        self.assertEqual(
            answer,
            "Go to Settings > Security > Reset Password.",
        )
        self.assertEqual(score, 1.0)

    def test_faq_threshold_controls_when_a_partial_match_is_accepted(self) -> None:
        accepted, accepted_score = main.faq_respond("password reset", threshold=0.3)
        rejected, rejected_score = main.faq_respond("password reset", threshold=0.34)

        self.assertEqual(accepted, "Go to Settings > Security > Reset Password.")
        self.assertAlmostEqual(accepted_score, 1 / 3)
        self.assertIsNone(rejected)
        self.assertAlmostEqual(rejected_score, 1 / 3)

    def test_faq_empty_input_has_no_candidate(self) -> None:
        self.assertEqual(main.faq_respond("   !!!   "), (None, 0.0))

    def test_hybrid_routes_destructive_actions_before_faq_retrieval(self) -> None:
        response, route = main.hybrid_respond("How do I cancel my order?")
        self.assertEqual(route, "rule")
        self.assertEqual(
            response,
            "Destructive action detected. Routing to structured confirmation flow.",
        )

    def test_hybrid_routes_known_faqs_and_formats_similarity(self) -> None:
        response, route = main.hybrid_respond("When will my order arrive?")
        self.assertEqual(route, "faq")
        self.assertEqual(response, "Check Orders for tracking info.  (faq match=1.00)")

    def test_hybrid_routes_unknown_requests_to_agent(self) -> None:
        response, route = main.hybrid_respond("What's the weather like?")
        self.assertEqual(route, "agent")
        self.assertEqual(
            response,
            '(would call LLM agent for: "What\'s the weather like?")',
        )

    def test_demo_runs_to_completion_and_shows_all_routes(self) -> None:
        output = StringIO()
        with redirect_stdout(output):
            main.main()

        rendered = output.getvalue()
        self.assertIn("=== rule-based ELIZA-style ===", rendered)
        self.assertIn("=== hybrid routing ===", rendered)
        for route in ("[faq  ]", "[rule ]", "[agent]"):
            with self.subTest(route=route):
                self.assertIn(route, rendered)


if __name__ == "__main__":
    unittest.main()
