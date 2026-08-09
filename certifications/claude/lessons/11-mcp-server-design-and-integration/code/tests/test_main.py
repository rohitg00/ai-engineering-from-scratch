"""Tests for lesson 11 JSON-RPC and MCP simulator."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import (
    CURRENT_PROTOCOL_VERSION,
    LEGACY_PROTOCOL_VERSION,
    MCPClient,
    MCPServer,
    demo,
    deployment_plan,
)


class MCPTests(unittest.TestCase):
    def setUp(self):
        self.server = MCPServer()
        self.client = MCPClient(self.server)

    def test_shipped_capability_snapshot_matches_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "mcp-capability-snapshot.json"
        self.assertEqual(json.loads(artifact.read_text(encoding="utf-8")), demo())


    def test_initialize_negotiates_capabilities(self):
        result = self.client.initialize()
        self.assertEqual(result["protocolVersion"], LEGACY_PROTOCOL_VERSION)
        self.assertIn("tools", result["capabilities"])
        self.assertIn("sampling", self.server.client_capabilities)
        self.assertIn("roots", self.server.client_capabilities)
        self.assertTrue(self.server.initialized)

    def test_tool_discovery_returns_schema(self):
        self.client.initialize()
        tools = self.client.request("tools/list")["tools"]
        self.assertEqual(tools[0]["name"], "add")
        self.assertEqual(tools[0]["inputSchema"]["type"], "object")
        self.assertFalse(tools[0]["inputSchema"]["additionalProperties"])

    def test_tool_call_round_trip(self):
        self.client.initialize()
        result = self.client.request("tools/call", {"name": "add", "arguments": {"a": 2, "b": 5}})
        self.assertEqual(result["content"][0]["text"], "7")

    def test_resource_discovery_and_read(self):
        self.client.initialize()
        uri = self.client.request("resources/list")["resources"][0]["uri"]
        result = self.client.request("resources/read", {"uri": uri})
        self.assertIn("training", result["contents"][0]["text"])

    def test_prompt_discovery_and_get(self):
        self.client.initialize()
        self.assertEqual(self.client.request("prompts/list")["prompts"][0]["name"], "review")
        result = self.client.request("prompts/get", {"name": "review"})
        self.assertIn("rollback", result["messages"][0]["content"]["text"])

    def test_unknown_method_returns_json_rpc_error(self):
        self.client.initialize()
        response = self.server.handle({"jsonrpc": "2.0", "id": 9, "method": "unknown"})
        self.assertEqual(response["error"]["code"], -32601)
        self.assertEqual(response["id"], 9)

    def test_invalid_params_are_correlated(self):
        self.client.initialize()
        response = self.server.handle({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "add", "arguments": {"a": 1}}})
        self.assertEqual(response["id"], 3)
        self.assertEqual(response["error"]["code"], -32602)

    def test_capabilities_cannot_be_used_before_initialization(self):
        response = self.server.handle({"jsonrpc": "2.0", "id": 4, "method": "tools/list"})
        self.assertEqual(response["id"], 4)
        self.assertEqual(response["error"]["code"], -32002)
        self.assertFalse(self.server.initialized)

    def test_initialized_notification_without_request_does_not_unlock_server(self):
        self.server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"})
        response = self.server.handle({"jsonrpc": "2.0", "id": 5, "method": "resources/list"})
        self.assertEqual(response["error"]["code"], -32002)
        self.assertFalse(self.server.initialized)

    def test_advertised_property_type_violation_is_protocol_error(self):
        self.client.initialize()
        response = self.server.handle(
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {"name": "add", "arguments": {"a": "2", "b": 5}},
            }
        )
        self.assertEqual(response["id"], 6)
        self.assertEqual(response["error"]["code"], -32602)
        self.assertIn("a must be integer", response["error"]["message"])

    def test_boolean_is_not_accepted_as_advertised_integer(self):
        self.client.initialize()
        response = self.server.handle(
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {"name": "add", "arguments": {"a": True, "b": 5}},
            }
        )
        self.assertEqual(response["error"]["code"], -32602)

    def test_progress_and_logging_notifications_have_no_ids(self):
        self.client.initialize()
        self.client.request(
            "tools/call",
            {
                "name": "add",
                "arguments": {"a": 1, "b": 2},
                "_meta": {"progressToken": "job-7"},
            },
        )
        progress = [
            event for event in self.client.notifications if event["method"] == "notifications/progress"
        ]
        self.assertEqual([event["params"]["progress"] for event in progress], [0, 1])
        self.assertTrue(all("id" not in event for event in self.client.notifications))
        self.assertEqual(self.client.notifications[-1]["method"], "notifications/message")

    def test_progress_token_must_be_string_or_integer(self):
        self.client.initialize()
        response = self.server.handle(
            {
                "jsonrpc": "2.0",
                "id": 11,
                "method": "tools/call",
                "params": {
                    "name": "add",
                    "arguments": {"a": 1, "b": 2},
                    "_meta": {"progressToken": True},
                },
            }
        )
        self.assertEqual(response["error"]["code"], -32602)

    def test_roots_and_sampling_callbacks_require_negotiated_capabilities(self):
        server = MCPServer()
        client = MCPClient(server, advertise_callbacks=False)
        client.initialize()
        with self.assertRaisesRegex(ValueError, "did not negotiate roots"):
            server.request_client(client, "roots/list", {})
        with self.assertRaisesRegex(ValueError, "did not negotiate sampling"):
            server.request_client(client, "sampling/createMessage", {"messages": []})

    def test_negotiated_client_callbacks_are_correlated(self):
        self.client.initialize()
        roots = self.server.request_client(self.client, "roots/list", {})
        sample = self.server.request_client(
            self.client,
            "sampling/createMessage",
            {"messages": [{"role": "user", "content": {"type": "text", "text": "test"}}]},
        )
        self.assertEqual(roots["result"]["roots"][0]["name"], "Workspace")
        self.assertEqual(sample["result"]["stopReason"], "endTurn")
        self.assertNotEqual(roots["id"], sample["id"])

    def test_deployment_plan_exposes_routing_tradeoff(self):
        legacy = deployment_plan(LEGACY_PROTOCOL_VERSION, application_state=True)
        current = deployment_plan(CURRENT_PROTOCOL_VERSION, application_state=True)
        self.assertEqual(legacy["routing"], "sticky-or-shared-session-store")
        self.assertTrue(legacy["protocolSession"])
        self.assertEqual(current["routing"], "round-robin")
        self.assertFalse(current["protocolSession"])
        self.assertEqual(current["applicationState"], "explicit-handle-or-shared-store")


if __name__ == "__main__":
    unittest.main()
