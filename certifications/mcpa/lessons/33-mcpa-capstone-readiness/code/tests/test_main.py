import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class CapstoneTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = main.run_scenario()
        self.server = self.scenario["server"]
        self.transcript = self.scenario["alice"].log + self.scenario["bob"].log

    def test_discover_offers_cache_hints_and_the_tasks_extension_after_version_correction(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        mismatch = client.send("server/discover", version="2025-11-25")
        self.assertEqual(mismatch["error"]["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(mismatch["error"]["data"]["supported"], [main.PROTOCOL_VERSION])
        discovered = client.send("server/discover")
        result = discovered["result"]
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["cacheScope"], "public")
        self.assertGreaterEqual(result["ttlMs"], 0)
        self.assertIn(main.TASKS_EXTENSION, result["capabilities"]["extensions"])

    def test_every_request_in_the_transcript_carries_meta_protocol_fields(self) -> None:
        requests = [
            entry["message"] if isinstance(entry, dict) and "message" in entry else entry
            for entry in self.transcript
        ]
        requests = [message for message in requests if isinstance(message, dict) and "method" in message and "id" in message]
        self.assertGreater(len(requests), 15)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertIsInstance(meta[main.PV_KEY], str)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_unknown_tool_is_invalid_params_never_method_not_found(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        response = client.send("tools/call", {"name": "close_incident_ticket", "arguments": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_listed_http_only_tool_is_a_tool_error_outside_the_authorized_endpoint(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        response = client.send("tools/call", {"name": "acknowledge_incident", "arguments": {"incident_id": "INC-7"}})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])

    def test_malformed_traceparent_does_not_interrupt_the_request(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        response = client.send("tools/list", traceparent="not-a-traceparent")
        self.assertEqual(response["result"]["resultType"], "complete")

    def test_unknown_method_is_method_not_found_not_invalid_params(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        response = client.send("tools/execute", {"name": "scan_fleet_health", "arguments": {}})
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_schema_invalid_restart_is_a_tool_execution_error_the_model_can_correct(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        response = client.send(
            "tools/call", {"name": "restart_service", "arguments": {"service": "checkout-api"}},
            capabilities=main.ELICIT_CAPS,
        )
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("environment", response["result"]["content"][0]["text"])
        corrected = client.send(
            "tools/call", {"name": "restart_service", "arguments": {"service": "checkout-api", "environment": "production"}},
            capabilities=main.ELICIT_CAPS,
        )
        self.assertEqual(corrected["result"]["resultType"], "input_required")

    def test_restart_without_elicitation_capability_is_a_missing_capability_error(self) -> None:
        server = main.build_server()
        client = main.Client("bob-readonly", server)
        response = client.send(
            "tools/call", {"name": "restart_service", "arguments": {"service": "checkout-api", "environment": "production"}},
            capabilities={},
        )
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("elicitation", response["error"]["data"]["requiredCapabilities"])

    def test_mrtr_consent_round_trip_uses_a_new_id_and_echoes_request_state_exactly(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        args = {"service": "checkout-api", "environment": "production"}
        ask = client.send("tools/call", {"name": "restart_service", "arguments": args}, capabilities=main.ELICIT_CAPS)
        self.assertEqual(ask["result"]["resultType"], "input_required")
        self.assertIn("confirm", ask["result"]["inputRequests"])
        state = ask["result"]["requestState"]
        ask_request = client.log[-2]
        retry = client.send(
            "tools/call", {"name": "restart_service", "arguments": args}, capabilities=main.ELICIT_CAPS,
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}}, request_state=state,
        )
        retry_request = client.log[-2]
        self.assertNotEqual(retry_request["id"], ask_request["id"])
        self.assertEqual(retry_request["params"]["requestState"], state)
        self.assertFalse(retry["result"]["isError"])
        self.assertTrue(retry["result"]["structuredContent"]["restarted"])

    def test_tampered_request_state_signature_is_rejected(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        args = {"service": "checkout-api", "environment": "production"}
        ask = client.send("tools/call", {"name": "restart_service", "arguments": args}, capabilities=main.ELICIT_CAPS)
        state = ask["result"]["requestState"]
        tampered = state[:-1] + ("0" if state[-1] != "0" else "1")
        response = client.send(
            "tools/call", {"name": "restart_service", "arguments": args}, capabilities=main.ELICIT_CAPS,
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}}, request_state=tampered,
        )
        self.assertTrue(response["result"]["isError"])
        self.assertIn("Confirmation rejected", response["result"]["content"][0]["text"])

    def test_diagnostics_only_becomes_a_task_when_the_client_declares_the_tasks_extension(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        synchronous = client.send("tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "edge-cache-7"}}, capabilities={})
        self.assertEqual(synchronous["result"]["resultType"], "complete")
        as_task = client.send(
            "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "checkout-api"}}, capabilities=main.TASKS_CAPS,
        )
        self.assertEqual(as_task["result"]["resultType"], "task")
        self.assertIn("taskId", as_task["result"])

    def test_task_completes_via_polling(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        created = client.send(
            "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "checkout-api"}}, capabilities=main.TASKS_CAPS,
        )
        task_id = created["result"]["taskId"]
        working = client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(working["result"]["status"], "working")
        server.advance_task(task_id)
        completed = client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(completed["result"]["status"], "completed")
        self.assertIn("result", completed["result"])

    def test_task_cancel_is_cooperative_and_reflected_on_the_next_poll(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        created = client.send(
            "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "billing-api"}}, capabilities=main.TASKS_CAPS,
        )
        task_id = created["result"]["taskId"]
        client.send("tasks/cancel", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        polled = client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(polled["result"]["status"], "cancelled")

    def test_tasks_get_requires_the_tasks_capability_on_that_request(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        created = client.send(
            "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "checkout-api"}}, capabilities=main.TASKS_CAPS,
        )
        task_id = created["result"]["taskId"]
        response = client.send("tasks/get", {"taskId": task_id}, capabilities={})
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)

    def test_wrong_audience_token_is_rejected_and_correct_audience_succeeds(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        status_wrong, response_wrong = client.call_http("acknowledge_incident", {"incident_id": "INC-9"}, "Bearer tok-foreign-svc")
        self.assertEqual(status_wrong, 401)
        self.assertIsNone(response_wrong)
        status_right, response_right = client.call_http("acknowledge_incident", {"incident_id": "INC-9"}, "Bearer tok-alice-oncall")
        self.assertEqual(status_right, 200)
        self.assertFalse(response_right["result"]["isError"])

    def test_trace_id_is_preserved_across_every_hop_of_the_narrative(self) -> None:
        root_trace = self.scenario["root_trace"]
        requests = [
            entry["message"] if isinstance(entry, dict) and "message" in entry else entry
            for entry in self.transcript
        ]
        traced = [
            message for message in requests
            if isinstance(message, dict) and "method" in message
            and main.TRACEPARENT_KEY in message.get("params", {}).get("_meta", {})
        ]
        self.assertGreater(len(traced), 15)
        for message in traced:
            traceparent = message["params"]["_meta"][main.TRACEPARENT_KEY]
            self.assertEqual(main.parse_traceparent(traceparent)["trace_id"], root_trace)

    def test_progress_notifications_carry_the_progress_token_and_stop_before_the_final_result(self) -> None:
        server = main.build_server()
        client = main.Client("alice-oncall", server)
        client.send("tools/call", {"name": "scan_fleet_health", "arguments": {}}, progress_token="scan-42")
        progress = [entry for entry in client.log if isinstance(entry, dict) and entry.get("method") == "notifications/progress"]
        self.assertEqual(len(progress), 3)
        for notification in progress:
            self.assertEqual(notification["params"]["progressToken"], "scan-42")
            self.assertNotIn("id", notification)
        self.assertEqual([entry["params"]["progress"] for entry in progress], [1, 2, 3])
        self.assertEqual(client.log[-1]["result"]["resultType"], "complete")

    def test_audit_log_hash_chain_verifies_and_tampering_is_detected(self) -> None:
        ok, broken_at = self.server.audit.verify()
        self.assertTrue(ok)
        self.assertIsNone(broken_at)
        self.assertGreater(len(self.server.audit.entries), 10)
        original = self.server.audit.entries[2].detail
        self.server.audit.entries[2].detail = original + " (tampered)"
        ok_after, broken_at_after = self.server.audit.verify()
        self.assertFalse(ok_after)
        self.assertEqual(broken_at_after, 2)

    def test_transcript_never_uses_a_legacy_method_or_a_forbidden_error_code(self) -> None:
        legacy_methods = {
            "initialize", "notifications/initialized", "ping", "logging/setLevel",
            "resources/subscribe", "resources/unsubscribe", "tasks/result", "tasks/list",
        }
        forbidden_codes = set(range(-32019, -31999)) | {-32002, -32042}
        for entry in self.transcript:
            message = entry["message"] if isinstance(entry, dict) and "message" in entry else entry
            if not isinstance(message, dict):
                continue
            self.assertNotIn(message.get("method"), legacy_methods)
            error = message.get("error")
            if isinstance(error, dict):
                self.assertNotIn(error.get("code"), forbidden_codes)


if __name__ == "__main__":
    unittest.main()
