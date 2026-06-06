"""Unit tests for the output-side classifiers and the router."""

from __future__ import annotations

import unittest

from classifiers import (
    InstructionLeakageClassifier,
    PIIClassifier,
    ToxicityClassifier,
)
from main import Router


class TestToxicity(unittest.TestCase):
    def setUp(self) -> None:
        self.clf = ToxicityClassifier()

    def test_clean_text_is_none(self) -> None:
        v = self.clf.classify("That was a clear and helpful answer.")
        self.assertEqual(v.severity, "none")

    def test_single_term_low(self) -> None:
        v = self.clf.classify("You are a moron.")
        self.assertEqual(v.severity, "low")
        self.assertGreater(v.score, 0.0)

    def test_three_terms_high(self) -> None:
        v = self.clf.classify("You moron, you idiot, you worthless person.")
        self.assertEqual(v.severity, "high")

    def test_negation_window_skips(self) -> None:
        v = self.clf.classify("You are not stupid, that was a good idea.")
        self.assertEqual(v.severity, "none")

    def test_redact_replaces_term(self) -> None:
        out = self.clf.redact("You are a moron and a scumbag.")
        self.assertIn("[redacted-language]", out)
        self.assertNotIn("moron", out.lower())


class TestPII(unittest.TestCase):
    def setUp(self) -> None:
        self.clf = PIIClassifier()

    def test_email_is_medium(self) -> None:
        v = self.clf.classify("Reach us at hello@example.com soon.")
        self.assertEqual(v.severity, "medium")

    def test_valid_card_is_high(self) -> None:
        v = self.clf.classify("Card on file: 4111 1111 1111 1111.")
        self.assertEqual(v.severity, "high")

    def test_invalid_card_not_flagged(self) -> None:
        v = self.clf.classify("Random digits: 1234 5678 9012 3456.")
        self.assertNotIn("high", v.severity)

    def test_redact_email_and_card(self) -> None:
        out = self.clf.redact("Email me at jane@example.com or my card 4111 1111 1111 1111.")
        self.assertIn("[redacted-email]", out)
        self.assertIn("[redacted-card]", out)

    def test_ip_address_low(self) -> None:
        v = self.clf.classify("Server at 192.168.1.5 is up.")
        self.assertEqual(v.severity, "low")


class TestInstructionLeakage(unittest.TestCase):
    def test_leaks_system_prompt(self) -> None:
        sys_p = "You are PolicyBot. Refuse harmful requests. Cite sources."
        clf = InstructionLeakageClassifier(sys_p)
        v = clf.classify("As PolicyBot, I refuse harmful requests and I cite sources to the user.")
        self.assertIn(v.severity, {"low", "medium", "high"})

    def test_no_overlap_is_none(self) -> None:
        clf = InstructionLeakageClassifier("You are PolicyBot, follow internal policy.")
        v = clf.classify("Here is a pasta recipe with mushrooms and butter.")
        self.assertEqual(v.severity, "none")


class TestRouterDecisions(unittest.TestCase):
    def setUp(self) -> None:
        self.router = Router()

    def test_clean_is_log(self) -> None:
        a = self.router.run("Here is your requested haiku about autumn.")
        self.assertEqual(a.verb, "log")

    def test_low_toxicity_is_warn(self) -> None:
        a = self.router.run("You moron, your code is full of bugs.")
        self.assertEqual(a.verb, "warn")
        self.assertIn("[note", a.output)

    def test_email_is_redact(self) -> None:
        a = self.router.run("Reach me at lee@example.com tomorrow.")
        self.assertEqual(a.verb, "redact")
        self.assertIn("[redacted-email]", a.output)

    def test_card_is_block(self) -> None:
        a = self.router.run("Your card on file is 4111 1111 1111 1111.")
        self.assertEqual(a.verb, "block")
        self.assertNotIn("4111", a.output)


class TestRouterAggregation(unittest.TestCase):
    def test_block_dominates_redact(self) -> None:
        text = "Card 4111 1111 1111 1111. Also email a@b.com. Also you are a moron."
        a = Router().run(text)
        self.assertEqual(a.verb, "block")

    def test_metadata_lists_fired(self) -> None:
        text = "lee@example.com is great."
        a = Router().run(text)
        self.assertIn("pii", a.metadata["fired"])


if __name__ == "__main__":
    unittest.main()
