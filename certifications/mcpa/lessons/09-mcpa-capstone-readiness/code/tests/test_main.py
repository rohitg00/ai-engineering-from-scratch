import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CapstoneReadinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.host = main.Host(client=main.MockClient(server=main.build_ops_server()))

    def test_handshake_negotiates_protocol_version(self) -> None:
        response = self.host.initialize()
        self.assertEqual(response["result"]["protocolVersion"], main.PROTOCOL_VERSION)
        self.assertIn("tools", response["result"]["capabilities"])

    def test_response_id_matches_request_id(self) -> None:
        response = self.host.initialize()
        self.assertEqual(response["id"], 1)

    def test_discovery_lists_tools_with_schema_and_annotations(self) -> None:
        tools = self.host.discover()
        names = {tool["name"] for tool in tools}
        self.assertEqual(names, {"check_status", "restart_service"})
        restart = next(tool for tool in tools if tool["name"] == "restart_service")
        self.assertIn("service", restart["inputSchema"]["properties"])
        self.assertTrue(restart["annotations"]["destructiveHint"])

    def test_schema_invalid_call_rejected_with_invalid_params(self) -> None:
        self.host.discover()
        response = self.host.call_tool("restart_service", {})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unknown_tool_returns_method_not_found(self) -> None:
        self.host.discover()
        response = self.host.call_tool("shutdown_datacenter", {})
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_side_effecting_call_without_consent_is_refused(self) -> None:
        self.host.discover()
        response = self.host.call_tool("restart_service", {"service": "billing-api"})
        self.assertEqual(response["error"]["code"], main.CONSENT_REQUIRED)
        self.assertIsNone(response["id"])

    def test_read_only_call_does_not_require_consent(self) -> None:
        self.host.discover()
        response = self.host.call_tool("check_status", {"service": "billing-api"})
        self.assertNotIn("error", response)
        self.assertIn("healthy", response["result"]["content"][0]["text"])

    def test_consented_valid_call_runs_and_is_recorded_in_audit_log(self) -> None:
        self.host.discover()
        self.host.grant_consent("restart_service")
        response = self.host.call_tool("restart_service", {"service": "billing-api"})
        self.assertNotIn("error", response)
        self.assertIn("restarted", response["result"]["content"][0]["text"])
        self.assertEqual(len(self.host.audit_log.entries), 1)
        self.assertEqual(self.host.audit_log.entries[0].status, "ok")

    def test_audit_log_verify_passes_after_run(self) -> None:
        self.host.discover()
        self.host.call_tool("restart_service", {})
        self.host.call_tool("restart_service", {"service": "billing-api"})
        self.host.grant_consent("restart_service")
        self.host.call_tool("restart_service", {"service": "billing-api"})
        self.assertEqual(len(self.host.audit_log.entries), 3)
        self.assertTrue(self.host.audit_log.verify())

    def test_tampering_with_an_entry_breaks_verify(self) -> None:
        self.host.discover()
        self.host.grant_consent("restart_service")
        self.host.call_tool("restart_service", {"service": "billing-api"})
        self.host.audit_log.entries[0].detail = "executed, but edited after the fact"
        self.assertFalse(self.host.audit_log.verify())


if __name__ == "__main__":
    unittest.main()
