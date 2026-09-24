import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ManifestReviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.acme_client, self.acme_report, self.docs_client, self.docs_report = main.run_scenario()

    def test_defaults_applied_when_annotations_are_omitted(self) -> None:
        bare_tool = {"name": "bare_tool", "inputSchema": {"type": "object"}}
        effective = main.effective_annotations(bare_tool)
        self.assertEqual(
            effective,
            {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False, "openWorldHint": True},
        )

    def test_destructive_tool_without_annotations_is_flagged(self) -> None:
        messages = [f.message for f in self.acme_report.findings if f.tool == "delete_account"]
        self.assertTrue(any("destructiveHint" in message for message in messages))

    def test_read_only_tool_is_not_flagged_as_destructive(self) -> None:
        annotation_findings = [f for f in self.acme_report.findings if f.area == "annotations"]
        self.assertTrue(all(f.tool not in {"get_balance", "run_report", "rotate_api_key"} for f in annotation_findings))

    def test_x_mcp_header_on_secret_looking_parameter_is_flagged(self) -> None:
        messages = [f.message for f in self.acme_report.findings if f.tool == "rotate_api_key"]
        self.assertTrue(any("secret" in message for message in messages))

    def test_x_mcp_header_with_invalid_token_syntax_is_flagged(self) -> None:
        messages = [f.message for f in self.acme_report.findings if f.tool == "run_report"]
        self.assertTrue(any("MUST drop" in message for message in messages))

    def test_x_mcp_header_on_number_type_is_flagged(self) -> None:
        tool = {
            "name": "priced_tool",
            "inputSchema": {"type": "object", "properties": {"amount": {"type": "number", "x-mcp-header": "Amount"}}},
        }
        findings: list[main.Finding] = []
        main.lint_x_mcp_header(tool, findings)
        self.assertTrue(any("number" in f.message for f in findings))

    def test_x_mcp_header_on_object_type_or_non_string_value_is_flagged(self) -> None:
        tool = {
            "name": "shaped_tool",
            "inputSchema": {"type": "object", "properties": {
                "filters": {"type": "object", "x-mcp-header": "Filters"},
                "region": {"type": "string", "x-mcp-header": 7},
            }},
        }
        findings: list[main.Finding] = []
        main.lint_x_mcp_header(tool, findings)
        messages = [f.message for f in findings]
        self.assertTrue(any("object property" in message for message in messages))
        self.assertTrue(any("is not a string" in message for message in messages))

    def test_public_cache_scope_with_private_looking_text_is_flagged(self) -> None:
        caching_findings = [f for f in self.acme_report.findings if f.area == "caching"]
        self.assertTrue(any("tools/list" in f.message for f in caching_findings))

    def test_instructions_with_steering_language_are_flagged(self) -> None:
        instruction_findings = [f for f in self.acme_report.findings if f.area == "instructions"]
        self.assertTrue(instruction_findings)

    def test_server_json_name_without_namespace_is_rejected(self) -> None:
        self.assertIsNone(self.acme_report.namespace)
        server_json_findings = [f for f in self.acme_report.findings if f.area == "server.json"]
        self.assertTrue(server_json_findings)

    def test_server_json_name_with_namespace_is_parsed(self) -> None:
        self.assertIsNotNone(self.docs_report.namespace)
        self.assertEqual(self.docs_report.namespace.authority, "io.github.acmedocs")
        self.assertEqual(self.docs_report.namespace.verification, "github")

    def test_clean_manifest_has_no_findings(self) -> None:
        self.assertEqual(self.docs_report.findings, [])
        self.assertTrue(self.docs_report.is_clean())

    def test_every_discover_and_list_request_carries_protocol_meta(self) -> None:
        for client in (self.acme_client, self.docs_client):
            requests = [message for message in client.log if "method" in message]
            self.assertEqual(len(requests), 2)
            for request in requests:
                meta = request["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_every_result_in_the_transcript_is_complete(self) -> None:
        for entry in main.transcript():
            if isinstance(entry, dict) and "result" in entry:
                self.assertEqual(entry["result"]["resultType"], "complete")


if __name__ == "__main__":
    unittest.main()
