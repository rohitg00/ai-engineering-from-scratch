"""Tests for the lesson 11 stateless MCP 2026-07-28 simulator."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import (
    CLIENT_CAPABILITIES_KEY,
    CLIENT_INFO_KEY,
    Capability,
    CURRENT_PROTOCOL_VERSION,
    MCPClient,
    MCPServer,
    PROTOCOL_VERSION_KEY,
    REQUEST_STATE_DISPLAY_PLACEHOLDER,
    SERVER_INFO_KEY,
    canonicalize_demo_transcript,
    demo,
    streamable_http_profile,
)


TEST_STATE_SECRET = b"lesson-11-deterministic-test-state-key"


class MCPTests(unittest.TestCase):
    def setUp(self):
        self.server = MCPServer(state_secret=TEST_STATE_SECRET)
        self.client = MCPClient(self.server)

    @staticmethod
    def wire_request(
        method,
        params=None,
        *,
        request_id=1,
        version=CURRENT_PROTOCOL_VERSION,
        capabilities=None,
    ):
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": {
                **(params or {}),
                "_meta": {
                    PROTOCOL_VERSION_KEY: version,
                    CLIENT_INFO_KEY: {"name": "test-client", "version": "1.0.0"},
                    CLIENT_CAPABILITIES_KEY: capabilities or {},
                },
            },
        }

    def test_shipped_capability_snapshot_matches_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "mcp-capability-snapshot.json"
        self.assertEqual(
            json.loads(artifact.read_text(encoding="utf-8")),
            canonicalize_demo_transcript(demo(state_secret=TEST_STATE_SECRET)),
        )

    def test_server_requires_explicit_state_secret(self):
        with self.assertRaisesRegex(TypeError, "state_secret"):
            MCPServer()

    def test_canonical_transcripts_hide_secret_specific_request_state(self):
        first_raw = demo(state_secret=b"first-deterministic-state-secret")
        second_raw = demo(state_secret=b"second-deterministic-state-secret")
        first_state = first_raw["mrtrAcrossInstances"]["inputRequired"]["requestState"]
        second_state = second_raw["mrtrAcrossInstances"]["inputRequired"]["requestState"]

        first_canonical = canonicalize_demo_transcript(first_raw)
        second_canonical = canonicalize_demo_transcript(second_raw)

        self.assertNotEqual(first_state, second_state)
        self.assertEqual(first_canonical, second_canonical)
        self.assertEqual(
            first_canonical["mrtrAcrossInstances"]["inputRequired"]["requestState"],
            REQUEST_STATE_DISPLAY_PLACEHOLDER,
        )
        self.assertEqual(
            first_raw["mrtrAcrossInstances"]["inputRequired"]["requestState"],
            first_state,
        )

    def test_discovery_is_mandatory_current_shape(self):
        result = self.client.request("server/discover")
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["supportedVersions"], [CURRENT_PROTOCOL_VERSION])
        self.assertEqual(sorted(result["capabilities"]), ["prompts", "resources", "tools"])
        self.assertEqual(result["cacheScope"], "public")
        self.assertGreater(result["ttlMs"], 0)
        self.assertEqual(result["_meta"][SERVER_INFO_KEY]["name"], "study-server")

    def test_client_puts_protocol_metadata_on_every_request(self):
        first = self.client.build_request("tools/list")
        second = self.client.build_request("resources/list")
        for request in (first, second):
            metadata = request["params"]["_meta"]
            self.assertEqual(metadata[PROTOCOL_VERSION_KEY], CURRENT_PROTOCOL_VERSION)
            self.assertIsInstance(metadata[CLIENT_CAPABILITIES_KEY], dict)
            self.assertEqual(metadata[CLIENT_INFO_KEY]["name"], "study-client")
        self.assertNotEqual(first["id"], second["id"])

    def test_missing_required_request_metadata_is_invalid_params(self):
        response = self.server.handle(
            {"jsonrpc": "2.0", "id": 4, "method": "tools/list", "params": {}}
        )
        self.assertEqual(response["error"]["code"], -32602)
        self.assertIn("_meta", response["error"]["message"])

    def test_invalid_request_ids_with_valid_envelope_use_null_error_id(self):
        for request_id in (None, True, 1.5, [], {}):
            with self.subTest(request_id=request_id):
                request = self.wire_request("tools/list", request_id=request_id)
                response, notifications = self.server.exchange(request)
                self.assertEqual(response["id"], None)
                self.assertEqual(response["error"]["code"], -32600)
                self.assertEqual(notifications, [])

    def test_malformed_json_rpc_version_preserves_valid_request_id(self):
        request = self.wire_request("tools/list", request_id=7)
        request["jsonrpc"] = "1.0"

        response, notifications = self.server.exchange(request)

        self.assertEqual(response["id"], 7)
        self.assertEqual(response["error"]["code"], -32600)
        self.assertEqual(notifications, [])

    def test_structurally_valid_notifications_emit_no_json_rpc_response(self):
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/cancelled",
            "params": {"requestId": 9, "reason": "client stopped waiting"},
        }

        response, notifications = self.server.exchange(notification)

        self.assertIsNone(response)
        self.assertEqual(notifications, [])

    def test_request_only_methods_without_ids_are_silent(self):
        requests = (
            self.wire_request("server/discover"),
            self.wire_request("tools/list"),
            self.wire_request(
                "tools/call",
                {"name": "add", "arguments": {"a": 1, "b": 2}},
            ),
        )
        for request in requests:
            request.pop("id")
            with self.subTest(method=request["method"]):
                response, notifications = self.server.exchange(request)
                self.assertIsNone(response)
                self.assertEqual(notifications, [])

    def test_malformed_unknown_and_wrong_direction_notifications_are_silent(self):
        notifications_to_ignore = (
            {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": []},
            {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {},
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": True},
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": 1, "reason": []},
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progressToken": "p", "progress": 1},
            },
        )
        for notification in notifications_to_ignore:
            with self.subTest(notification=notification):
                response, notifications = self.server.exchange(notification)
                self.assertIsNone(response)
                self.assertEqual(notifications, [])

    def test_malformed_no_id_objects_return_invalid_request(self):
        malformed_requests = (
            {"jsonrpc": "1.0", "method": 7, "params": {}},
            {"jsonrpc": "2.0", "method": "tools/list", "params": 7},
        )
        for request in malformed_requests:
            with self.subTest(request=request):
                response, notifications = self.server.exchange(request)
                self.assertEqual(response["id"], None)
                self.assertEqual(response["error"]["code"], -32600)
                self.assertEqual(notifications, [])

    def test_unsupported_version_uses_exact_mcp_error_data(self):
        response = self.server.handle(
            self.wire_request("tools/list", version="2025-11-25")
        )
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [CURRENT_PROTOCOL_VERSION], "requested": "2025-11-25"},
        )

    def test_tool_list_is_deterministic_and_cacheable(self):
        first = self.client.request("tools/list")
        second = self.client.request("tools/list")
        self.assertEqual(first, second)
        self.assertEqual([tool["name"] for tool in first["tools"]], ["add", "prepare_review"])
        self.assertEqual(first["resultType"], "complete")
        self.assertEqual(first["cacheScope"], "public")

    def test_tool_call_returns_complete_result_and_request_scoped_progress(self):
        request = self.client.build_request(
            "tools/call",
            {
                "name": "add",
                "arguments": {"a": 2, "b": 5},
                "_meta": {"progressToken": "sum-7"},
            },
        )
        response, notifications = self.server.exchange(request)
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["content"][0]["text"], "7")
        self.assertEqual([event["params"]["progress"] for event in notifications], [0, 1])
        self.assertTrue(all("id" not in event for event in notifications))

    def test_advertised_integer_rejects_boolean(self):
        response = self.server.handle(
            self.wire_request(
                "tools/call", {"name": "add", "arguments": {"a": True, "b": 5}}
            )
        )
        self.assertEqual(response["error"]["code"], -32602)

    def test_capability_rejects_missing_and_unsupported_schema_types_explicitly(self):
        for declared_type in (None, "number"):
            with self.subTest(declared_type=declared_type):
                schema = {"properties": {"topic": {}}}
                if declared_type is not None:
                    schema["properties"]["topic"]["type"] = declared_type
                capability = Capability("review", "Review a topic.", schema, lambda args: args)
                with self.assertRaisesRegex(
                    ValueError,
                    rf"unsupported schema type for topic: {declared_type!r}",
                ):
                    capability.validate_arguments({"topic": "release"})

    def test_resource_and_prompt_results_are_complete(self):
        listed = self.client.request("resources/list")
        read = self.client.request("resources/read", {"uri": listed["resources"][0]["uri"]})
        prompt = self.client.request("prompts/get", {"name": "review"})
        self.assertEqual(listed["resultType"], "complete")
        self.assertEqual(read["cacheScope"], "private")
        self.assertIn("training", read["contents"][0]["text"])
        self.assertEqual(prompt["resultType"], "complete")
        self.assertIn("rollback", prompt["messages"][0]["content"]["text"])

    def test_initialize_is_not_a_current_core_method(self):
        response = self.server.handle(self.wire_request("initialize"))
        self.assertEqual(response["error"]["code"], -32601)
        self.assertIn("Method not found", response["error"]["message"])

    def test_mrtr_requests_roots_sampling_and_elicitation_in_result(self):
        result = self.client.request(
            "tools/call",
            {"name": "prepare_review", "arguments": {"topic": "release safety"}},
        )
        self.assertEqual(result["resultType"], "input_required")
        self.assertEqual(
            {request["method"] for request in result["inputRequests"].values()},
            {"roots/list", "sampling/createMessage", "elicitation/create"},
        )
        self.assertIsInstance(result["requestState"], str)

    def test_mrtr_input_responses_use_bare_method_payloads(self):
        responses = self.client.fulfill(
            {
                "workspace_scope": {"method": "roots/list", "params": {}},
                "review_sample": {"method": "sampling/createMessage", "params": {}},
                "review_goal": {"method": "elicitation/create", "params": {}},
            }
        )
        self.assertTrue(all("resultType" not in value for value in responses.values()))
        self.assertIn("roots", responses["workspace_scope"])
        self.assertEqual("assistant", responses["review_sample"]["role"])
        self.assertEqual("accept", responses["review_goal"]["action"])

    def test_mrtr_requires_declared_client_capabilities(self):
        response = self.server.handle(
            self.wire_request(
                "tools/call",
                {"name": "prepare_review", "arguments": {"topic": "release safety"}},
                capabilities={},
            )
        )
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"]["requiredCapabilities"],
            {"roots": {}, "sampling": {}, "elicitation": {"form": {}}},
        )

    def test_url_only_elicitation_does_not_satisfy_form_input(self):
        response = self.server.handle(
            self.wire_request(
                "tools/call",
                {"name": "prepare_review", "arguments": {"topic": "release safety"}},
                capabilities={
                    "roots": {},
                    "sampling": {},
                    "elicitation": {"url": {}},
                },
            )
        )
        self.assertEqual(-32021, response["error"]["code"])
        self.assertEqual(
            {"elicitation": {"form": {}}},
            response["error"]["data"]["requiredCapabilities"],
        )

    def test_mrtr_retry_uses_new_id_and_can_reach_another_instance(self):
        trace = self.client.call_with_mrtr(
            {"name": "prepare_review", "arguments": {"topic": "release safety"}},
            first_server=MCPServer(state_secret=TEST_STATE_SECRET),
            retry_server=MCPServer(state_secret=TEST_STATE_SECRET),
        )
        self.assertNotEqual(trace["initialRequestId"], trace["retryRequestId"])
        self.assertEqual(trace["inputRequired"]["resultType"], "input_required")
        self.assertEqual(trace["complete"]["resultType"], "complete")
        self.assertIn("find correctness risks", trace["complete"]["content"][0]["text"])

    def test_tampered_request_state_is_rejected(self):
        initial = self.client.request(
            "tools/call",
            {"name": "prepare_review", "arguments": {"topic": "release safety"}},
        )
        responses = self.client.fulfill(initial["inputRequests"])
        response = self.server.handle(
            self.wire_request(
                "tools/call",
                {
                    "name": "prepare_review",
                    "arguments": {"topic": "release safety"},
                    "inputResponses": responses,
                    "requestState": initial["requestState"] + "tampered",
                },
                capabilities={"roots": {}, "sampling": {}, "elicitation": {}},
            )
        )
        self.assertEqual(response["error"]["code"], -32602)
        self.assertIn("integrity", response["error"]["message"])

    def test_missing_mrtr_response_is_requested_again(self):
        initial = self.client.request(
            "tools/call",
            {"name": "prepare_review", "arguments": {"topic": "release safety"}},
        )
        responses = self.client.fulfill(initial["inputRequests"])
        responses.pop("review_goal")
        retry = self.client.request(
            "tools/call",
            {
                "name": "prepare_review",
                "arguments": {"topic": "release safety"},
                "inputResponses": responses,
                "requestState": initial["requestState"],
            },
        )
        self.assertEqual(retry["resultType"], "input_required")
        self.assertEqual(list(retry["inputRequests"]), ["review_goal"])
        self.assertEqual(retry["requestState"], initial["requestState"])

    def test_malformed_mrtr_response_objects_are_invalid_params(self):
        initial = self.client.request(
            "tools/call",
            {"name": "prepare_review", "arguments": {"topic": "release safety"}},
        )
        valid_responses = self.client.fulfill(initial["inputRequests"])
        malformed = (
            ("workspace_scope", []),
            ("review_sample", "not-an-object"),
            ("review_goal", 7),
            ("review_goal", {"action": "accept", "content": []}),
        )
        for key, value in malformed:
            with self.subTest(key=key, value=value):
                responses = {**valid_responses, key: value}
                response = self.server.handle(
                    self.wire_request(
                        "tools/call",
                        {
                            "name": "prepare_review",
                            "arguments": {"topic": "release safety"},
                            "inputResponses": responses,
                            "requestState": initial["requestState"],
                        },
                        capabilities={"roots": {}, "sampling": {}, "elicitation": {}},
                    )
                )
                self.assertEqual(response["error"]["code"], -32602)

    def test_current_streamable_http_has_no_protocol_session_endpoints(self):
        profile = streamable_http_profile()
        self.assertEqual(profile["method"], "POST")
        self.assertFalse(profile["protocolSessions"])
        self.assertFalse(profile["supportsGetStream"])
        self.assertFalse(profile["supportsDeleteSession"])
        self.assertFalse(profile["supportsLastEventId"])
        self.assertEqual(profile["changeNotifications"], "subscriptions/listen")

    def test_unknown_method_returns_correlated_json_rpc_error(self):
        response = self.server.handle(self.wire_request("unknown", request_id=99))
        self.assertEqual(response["id"], 99)
        self.assertEqual(response["error"]["code"], -32601)


if __name__ == "__main__":
    unittest.main()
