import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class DeprecatedClientFeaturesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.Server()

    def test_roots_capability_is_flagged_with_migration_path(self) -> None:
        findings = main.advise_migrations({}, {"roots": {}})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].feature, "roots")
        self.assertIn("tool parameters", findings[0].migration)

    def test_sampling_capability_is_flagged_with_migration_path(self) -> None:
        findings = main.advise_migrations({}, {"sampling": {}})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].feature, "sampling")
        self.assertIn("LLM provider", findings[0].migration)

    def test_logging_capability_is_flagged_with_migration_path(self) -> None:
        findings = main.advise_migrations({"logging": {}}, {})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].feature, "logging")
        self.assertIn("stderr", findings[0].migration)

    def test_capabilities_without_deprecated_features_yield_no_findings(self) -> None:
        findings = main.advise_migrations({"completions": {}}, {"elicitation": {"form": {}}})
        self.assertEqual(findings, [])

    def test_earliest_removal_is_twelve_months_after_the_deprecating_revision(self) -> None:
        self.assertEqual(main.earliest_removal(), "2027-07-28")
        self.assertEqual(main.add_months("2026-01-31", 1), "2026-02-28")

    def test_summarize_workspace_without_capabilities_returns_missing_required_client_capability(self) -> None:
        client = main.Client(self.server, capabilities={})
        response = client.call("summarize_workspace", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("roots", response["error"]["data"]["requiredCapabilities"])
        self.assertIn("sampling", response["error"]["data"]["requiredCapabilities"])

    def test_summarize_workspace_requests_roots_and_sampling_as_mrtr_inputs(self) -> None:
        client = main.Client(self.server, capabilities={"roots": {}, "sampling": {}})
        response = client.call("summarize_workspace", {})
        result = response["result"]
        self.assertEqual(result["resultType"], "input_required")
        self.assertEqual(result["inputRequests"]["workspace_roots"]["method"], "roots/list")
        self.assertEqual(result["inputRequests"]["workspace_summary"]["method"], "sampling/createMessage")
        self.assertNotIn("ttlMs", result)

    def test_summarize_workspace_retry_uses_a_new_id_and_echoes_request_state(self) -> None:
        client = main.Client(self.server, capabilities={"roots": {}, "sampling": {}})
        first = client.call("summarize_workspace", {})
        first_id = client.log[0]["id"]
        state = first["result"]["requestState"]
        second = client.call(
            "summarize_workspace",
            {},
            input_responses={
                "workspace_roots": {"roots": [{"uri": "file:///tmp/demo", "name": "demo"}]},
                "workspace_summary": {"role": "assistant", "content": {"type": "text", "text": "one root"}, "model": "m", "stopReason": "endTurn"},
            },
            request_state=state,
        )
        second_request_id = client.log[2]["id"]
        self.assertNotEqual(first_id, second_request_id)
        self.assertEqual(second["result"]["resultType"], "complete")
        self.assertEqual(second["result"]["structuredContent"]["roots"][0]["uri"], "file:///tmp/demo")

    def test_summarize_workspace_rejects_a_retry_with_the_wrong_request_state(self) -> None:
        client = main.Client(self.server, capabilities={"roots": {}, "sampling": {}})
        client.call("summarize_workspace", {})
        response = client.call(
            "summarize_workspace",
            {},
            input_responses={"workspace_roots": {"roots": []}, "workspace_summary": {}},
            request_state="not-the-real-state",
        )
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_run_diagnostic_without_log_level_emits_no_notifications(self) -> None:
        client = main.Client(self.server, capabilities={})
        client.call("run_diagnostic", {})
        notifications = [entry for entry in client.log if entry.get("method") == "notifications/message"]
        self.assertEqual(notifications, [])

    def test_run_diagnostic_with_log_level_emits_only_at_or_above_that_level(self) -> None:
        client = main.Client(self.server, capabilities={})
        client.call("run_diagnostic", {}, log_level="info")
        levels = [entry["params"]["level"] for entry in client.log if entry.get("method") == "notifications/message"]
        self.assertEqual(levels, ["info", "warning"])

    def test_run_diagnostic_rejects_an_unrecognized_log_level(self) -> None:
        client = main.Client(self.server, capabilities={})
        response = client.call("run_diagnostic", {}, log_level="verbose")
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_legacy_example_shows_a_removed_method_is_unknown_to_a_modern_server(self) -> None:
        legacy = main.legacy_logging_set_level_example(self.server)
        self.assertTrue(all(entry["legacy"] for entry in legacy))
        self.assertEqual(legacy[0]["message"]["method"], "logging/setLevel")
        self.assertEqual(legacy[1]["message"]["error"]["code"], main.METHOD_NOT_FOUND)


if __name__ == "__main__":
    unittest.main()
