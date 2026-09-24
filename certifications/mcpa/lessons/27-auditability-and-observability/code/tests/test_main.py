import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class TracePropagationAndAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = main.run_scenario()

    def test_traceparent_has_valid_w3c_format(self) -> None:
        value = main.new_root_traceparent()
        self.assertRegex(value, r"^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$")
        parsed = main.parse_traceparent(value)
        self.assertEqual(len(parsed["trace_id"]), 32)
        self.assertEqual(len(parsed["parent_id"]), 16)

    def test_malformed_traceparent_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            main.parse_traceparent("00-AB12-00f067aa0ba902b7-01")
        with self.assertRaises(ValueError):
            main.parse_traceparent("00-" + "0" * 32 + "-00f067aa0ba902b7-01")

    def test_malformed_inbound_traceparent_restarts_the_trace_instead_of_failing(self) -> None:
        response = self.scenario.client.call_tool("list_recent_grants", {}, traceparent="not-a-traceparent")
        self.assertNotIn("error", response)
        entry = self.scenario.ops.log.entries[-1]
        self.assertRegex(entry.trace_id, r"^[0-9a-f]{32}$")

    def test_child_span_keeps_trace_id_and_changes_parent_id(self) -> None:
        root = main.new_root_traceparent()
        child = main.child_traceparent(root)
        root_parsed = main.parse_traceparent(root)
        child_parsed = main.parse_traceparent(child)
        self.assertEqual(child_parsed["trace_id"], root_parsed["trace_id"])
        self.assertNotEqual(child_parsed["parent_id"], root_parsed["parent_id"])

    def test_traceparent_propagates_from_client_through_server_to_upstream(self) -> None:
        reset_requests = [
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call"
            and message.get("params", {}).get("name") == "reset_api_key"
            and message.get("params", {}).get("arguments", {}).get("account_id") == "acct-42"
        ]
        store_requests = [
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call" and message.get("params", {}).get("name") == "store_secret"
        ]
        self.assertEqual(len(reset_requests), 1)
        self.assertEqual(len(store_requests), 1)
        client_trace = main.parse_traceparent(reset_requests[0]["params"]["_meta"]["traceparent"])
        upstream_trace = main.parse_traceparent(store_requests[0]["params"]["_meta"]["traceparent"])
        self.assertEqual(client_trace["trace_id"], upstream_trace["trace_id"])
        self.assertNotEqual(client_trace["parent_id"], upstream_trace["parent_id"])

    def test_tracestate_and_baggage_propagate_unchanged_to_upstream(self) -> None:
        store_requests = [
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call" and message.get("params", {}).get("name") == "store_secret"
        ]
        meta = store_requests[0]["params"]["_meta"]
        self.assertEqual(meta.get("tracestate"), "vendor=ops-desk")
        self.assertEqual(meta.get("baggage"), "team=support")

    def test_sensitive_argument_is_redacted_in_both_logs(self) -> None:
        ops_entry = next(e for e in self.scenario.ops.log.entries if e.tool == "reset_api_key" and e.result_channel == "complete")
        vault_entry = next(e for e in self.scenario.vault.log.entries if e.tool == "store_secret")
        self.assertEqual(ops_entry.arguments["new_key"], main.REDACTED)
        self.assertEqual(ops_entry.arguments["account_id"], "acct-42")
        self.assertEqual(vault_entry.arguments["secret"], main.REDACTED)

    def test_principal_recorded_is_from_bearer_token_not_client_info(self) -> None:
        ops_entry = next(e for e in self.scenario.ops.log.entries if e.tool == "list_recent_grants")
        self.assertEqual(ops_entry.principal, "alice@example.com")
        request = next(
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call" and message.get("params", {}).get("name") == "list_recent_grants"
        )
        self.assertEqual(request["params"]["_meta"][main.CLIENT_INFO_KEY]["name"], "support-console")

    def test_unauthenticated_call_is_logged_and_denied(self) -> None:
        entry = next(e for e in self.scenario.ops.log.entries if e.principal == "unauthenticated")
        self.assertEqual(entry.result_channel, "protocol_error")
        self.assertIsNone(entry.tool)

    def test_hash_chain_verifies_on_a_clean_log(self) -> None:
        ok, broken_at = self.scenario.ops.log.verify()
        self.assertTrue(ok)
        self.assertIsNone(broken_at)

    def test_naive_tampering_is_caught_at_the_edited_entry(self) -> None:
        log = self.scenario.ops.log
        self.assertGreaterEqual(len(log.entries), 2)
        log.entries[0].arguments = dict(log.entries[0].arguments)
        log.entries[0].arguments["tampered"] = True
        ok, broken_at = log.verify()
        self.assertFalse(ok)
        self.assertEqual(broken_at, 0)

    def test_tampering_with_a_patched_hash_is_still_caught_one_entry_later(self) -> None:
        log = self.scenario.ops.log
        self.assertGreaterEqual(len(log.entries), 2)
        tampered = log.entries[0]
        tampered.arguments = dict(tampered.arguments)
        tampered.arguments["tampered"] = True
        tampered.hash = log._digest(
            tampered.prev_hash, tampered.timestamp, tampered.trace_id, tampered.request_id,
            tampered.principal, tampered.method, tampered.tool, tampered.arguments, tampered.result_channel,
        )
        ok, broken_at = log.verify()
        self.assertFalse(ok)
        self.assertEqual(broken_at, 1)

    def test_entries_across_servers_correlate_by_trace_id_not_request_id(self) -> None:
        ops_entry = next(e for e in self.scenario.ops.log.entries if e.tool == "reset_api_key" and e.result_channel == "complete")
        vault_entry = next(e for e in self.scenario.vault.log.entries if e.tool == "store_secret")
        self.assertEqual(ops_entry.trace_id, vault_entry.trace_id)
        self.assertNotEqual(ops_entry.request_id, vault_entry.request_id)

    def test_unknown_tool_is_a_protocol_error_not_a_tool_execution_error(self) -> None:
        request = next(
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call" and message.get("params", {}).get("name") == "delete_everything"
        )
        response = next(message for message in self.scenario.wire_log if message.get("id") == request["id"] and "error" in message)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_missing_required_argument_is_a_tool_execution_error(self) -> None:
        request = next(
            message for message in self.scenario.wire_log
            if message.get("method") == "tools/call"
            and message.get("params", {}).get("name") == "reset_api_key"
            and "new_key" not in message.get("params", {}).get("arguments", {})
        )
        response = next(message for message in self.scenario.wire_log if message.get("id") == request["id"] and "result" in message)
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])

    def test_every_request_in_the_transcript_carries_required_meta(self) -> None:
        requests = [message for message in self.scenario.wire_log if "method" in message]
        self.assertTrue(requests)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
