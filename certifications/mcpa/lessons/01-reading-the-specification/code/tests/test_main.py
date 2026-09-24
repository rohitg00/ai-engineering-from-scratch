import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class SpecReadingTests(unittest.TestCase):
    def test_must_and_must_not_classify_as_required_and_forbidden(self) -> None:
        self.assertEqual(main.classify_requirement("Servers MUST implement server/discover."), "required")
        self.assertEqual(main.classify_requirement("Implementations MUST NOT emit -32002."), "forbidden")

    def test_lowercase_keyword_carries_no_normative_weight(self) -> None:
        self.assertEqual(main.classify_requirement("The client must not batch requests."), "unspecified")
        self.assertEqual(main.classify_requirement("This paragraph is background only."), "unspecified")

    def test_should_and_may_classify_as_recommended_and_optional(self) -> None:
        self.assertEqual(main.classify_requirement("Clients SHOULD include clientInfo."), "recommended")
        self.assertEqual(main.classify_requirement("Servers MAY offer completions."), "optional")

    def test_should_not_and_not_recommended_both_classify_as_not_recommended(self) -> None:
        self.assertEqual(main.classify_requirement("This SHOULD NOT be relied upon."), "not_recommended")
        self.assertEqual(main.classify_requirement("Older patterns are NOT RECOMMENDED."), "not_recommended")

    def test_deprecated_feature_reports_its_migration_path(self) -> None:
        self.assertEqual(main.feature_state("logging", "2026-07-28"), "deprecated")
        self.assertIn("OpenTelemetry", main.migration_path("logging"))

    def test_feature_is_active_before_its_own_deprecation_revision(self) -> None:
        self.assertEqual(main.feature_state("roots", "2025-11-25"), "active")
        self.assertEqual(main.feature_state("roots", "2026-07-28"), "deprecated")

    def test_earliest_removal_is_computed_from_the_deprecation_window(self) -> None:
        self.assertEqual(main.earliest_removal("roots"), "2027-07-28")
        self.assertEqual(main.earliest_removal("dynamic-client-registration"), "2027-07-28")

    def test_feature_that_follows_another_shares_its_earliest_removal(self) -> None:
        self.assertEqual(
            main.earliest_removal("include-context-this-server-all-servers"),
            main.earliest_removal("sampling"),
        )

    def test_removed_feature_is_never_reported_as_current(self) -> None:
        state = main.feature_state("json-rpc-batching", "2026-07-28")
        self.assertEqual(state, "removed")
        self.assertNotEqual(state, "active")
        self.assertIsNone(main.earliest_removal("json-rpc-batching"))

    def test_unknown_feature_is_handled_without_raising(self) -> None:
        self.assertEqual(main.feature_state("does-not-exist", "2026-07-28"), "unknown")
        self.assertIsNone(main.earliest_removal("does-not-exist"))
        self.assertIsNone(main.migration_path("does-not-exist"))

    def test_changelog_lookup_by_sep_number(self) -> None:
        entry = main.changelog_lookup("SEP-2596")
        self.assertIsNotNone(entry)
        self.assertEqual(entry.revision, main.PROTOCOL_VERSION)
        self.assertIn("lifecycle", entry.summary)

    def test_unknown_sep_returns_none(self) -> None:
        self.assertIsNone(main.changelog_lookup("SEP-0000000"))

    def test_revision_state_distinguishes_current_from_final(self) -> None:
        self.assertEqual(main.revision_state("2026-07-28"), "Current")
        self.assertEqual(main.revision_state("2025-11-25"), "Final")
        self.assertEqual(main.revision_state("2099-01-01"), "unknown")

    def test_every_transcript_result_carries_a_result_type(self) -> None:
        for entry in main.transcript():
            message = entry.get("message", entry) if isinstance(entry, dict) and "violation" in entry else entry
            if isinstance(message, dict) and "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
