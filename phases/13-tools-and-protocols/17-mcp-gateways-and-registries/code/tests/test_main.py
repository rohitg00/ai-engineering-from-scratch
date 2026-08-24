"""Tests for the stateless MCP gateway."""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import time
import unittest


MODULE_PATH = pathlib.Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson17_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class GatewayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = main.Gateway()

    def call(self, bearer, method, params=None, request_id=1, **kwargs):
        body, headers = main.make_request(method, request_id, params)
        return self.gateway.handle(bearer, body, headers, **kwargs)

    def test_discover_advertises_current_protocol(self):
        status, response = self.call("bearer-alice", "server/discover")
        self.assertEqual(status, 200)
        self.assertEqual(response["result"]["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["cacheScope"], "private")

    def test_tools_list_is_principal_filtered_and_sorted(self):
        _, alice = self.call("bearer-alice", "tools/list")
        _, bob = self.call("bearer-bob", "tools/list")
        alice_names = [tool["name"] for tool in alice["result"]["tools"]]
        bob_names = [tool["name"] for tool in bob["result"]["tools"]]
        self.assertEqual(alice_names, sorted(alice_names))
        self.assertIn("notes.create", alice_names)
        self.assertNotIn("notes.create", bob_names)
        self.assertTrue(
            all(tool["inputSchema"]["type"] == "object" for tool in alice["result"]["tools"])
        )
        self.assertEqual(alice["result"]["resultType"], "complete")
        self.assertGreater(alice["result"]["ttlMs"], 0)
        self.assertEqual(
            alice["result"]["_meta"][main.SERVER_INFO_META]["name"],
            "enterprise-gateway",
        )

    def test_registry_server_json_requires_external_verified_admission(self):
        record = main.REGISTRY_SERVER_JSON["notes"]
        admission = main.VERIFIED_ADMISSION_STATE["notes"]
        self.assertEqual(record["name"], "com.example/notes")
        self.assertTrue(main.registry_record_is_admissible(record, admission))
        rejected = {
            **admission,
            "publisher": {"namespace": "com.example", "status": "unverified"},
        }
        self.assertFalse(main.registry_record_is_admissible(record, rejected))
        self.assertEqual(
            set(record),
            {"$schema", "name", "description", "version", "packages"},
        )

    def test_registry_record_rejects_wrong_namespace_or_invalid_package(self):
        admission = main.VERIFIED_ADMISSION_STATE["notes"]
        wrong_name = {**main.REGISTRY_SERVER_JSON["notes"], "name": "example.invalid/notes"}
        self.assertFalse(main.registry_record_is_admissible(wrong_name, admission))
        bad_package = {
            **main.REGISTRY_SERVER_JSON["notes"],
            "packages": [{"identifier": "@example/notes-mcp"}],
        }
        self.assertFalse(main.registry_record_is_admissible(bad_package, admission))

    def test_allowed_call_is_forwarded_with_fresh_backend_id(self):
        status, response = self.call(
            "bearer-alice",
            "tools/call",
            {"name": "notes.search", "arguments": {"query": "x"}},
            request_id=99,
        )
        self.assertEqual(status, 200)
        self.assertEqual(response["id"], 99)
        self.assertEqual(self.gateway.forwarded_request_ids, ["gw-1"])
        self.assertEqual(response["result"]["resultType"], "complete")

    def test_denied_call_is_audited(self):
        status, response = self.call("bearer-bob", "tools/call", {"name": "notes.create", "arguments": {}})
        self.assertEqual(status, 403)
        self.assertEqual(response["error"]["code"], -32003)
        self.assertEqual(self.gateway.audit[-1]["decision"], "deny")

    def test_rate_limit_is_keyed_by_principal(self):
        self.gateway.buckets["alice"] = main.TokenBucket(tokens=0, updated_at=time.monotonic())
        status, _ = self.call("bearer-alice", "tools/call", {"name": "notes.search", "arguments": {}})
        self.assertEqual(status, 429)
        self.assertEqual(self.gateway.audit[-1]["principal"], "alice")

    def test_descriptor_change_is_blocked_at_list_and_call(self):
        self.gateway.backends["notes"].tools[0]["description"] += " changed"
        _, listing = self.call("bearer-alice", "tools/list")
        names = [tool["name"] for tool in listing["result"]["tools"]]
        self.assertNotIn("notes.search", names)
        status, _ = self.call("bearer-alice", "tools/call", {"name": "notes.search", "arguments": {}})
        self.assertEqual(status, 409)

    def test_header_body_mismatch_is_rejected_before_route(self):
        body, headers = main.make_request("tools/call", 1, {"name": "notes.search", "arguments": {}})
        headers["Mcp-Name"] = "issues.open"
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)
        self.assertEqual(self.gateway.forwarded_request_ids, [])

    def test_header_version_mismatch_precedes_support_check(self):
        body, headers = main.make_request("tools/list", 41)
        body["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)

    def test_unsupported_version_has_exact_error_data(self):
        body, headers = main.make_request("tools/list", 42)
        requested = "2025-11-25"
        body["params"]["_meta"][main.PROTOCOL_META] = requested
        headers["MCP-Protocol-Version"] = requested
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["id"], 42)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": requested},
        )

    def test_unknown_method_is_json_rpc_404(self):
        body, headers = main.make_request("widgets/list", 43)
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 404)
        self.assertEqual(response["id"], 43)
        self.assertEqual(response["error"]["code"], -32601)

    def test_task_methods_route_by_task_id_header_before_dispatch(self):
        body, headers = main.make_request("tasks/get", 45, {"taskId": "task-7"})
        self.assertEqual(headers["Mcp-Name"], "task-7")
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 404)
        self.assertEqual(response["error"]["code"], -32601)

    def test_accepted_notification_returns_empty_202(self):
        body, headers = main.make_request("tools/list", 44)
        del body["id"]
        self.assertEqual(
            self.gateway.handle("bearer-alice", body, headers),
            (202, None),
        )

    def test_modern_get_and_delete_return_405(self):
        body, headers = main.make_request("server/discover", 1)
        self.assertEqual(self.gateway.handle("bearer-alice", body, headers, http_method="GET")[0], 405)
        self.assertEqual(self.gateway.handle("bearer-alice", body, headers, http_method="DELETE")[0], 405)

    def test_subscriptions_listen_is_post_response_sse(self):
        status, response = self.call(
            "bearer-alice",
            "subscriptions/listen",
            {"notifications": {"toolsListChanged": True}},
            request_id="listen-tools",
        )
        self.assertEqual(status, 200)
        self.assertEqual(response["contentType"], "text/event-stream")
        acknowledgment = response["events"][0]
        self.assertEqual(acknowledgment["method"], "notifications/subscriptions/acknowledged")
        self.assertEqual(acknowledgment["params"]["notifications"], {"toolsListChanged": True})
        self.assertEqual(
            acknowledgment["params"]["_meta"][main.SUBSCRIPTION_ID_META],
            "listen-tools",
        )

    def test_subscription_requires_sse_acceptance(self):
        status, _ = self.call(
            "bearer-alice",
            "subscriptions/listen",
            {"notifications": {"toolsListChanged": True}},
            accept="application/json",
        )
        self.assertEqual(status, 406)

    def test_subscription_acknowledges_only_supported_requested_types(self):
        _, response = self.call(
            "bearer-alice",
            "subscriptions/listen",
            {"notifications": {"toolsListChanged": True, "resourcesListChanged": True}},
        )
        acknowledged = response["events"][0]["params"]["notifications"]
        self.assertEqual(acknowledged, {"toolsListChanged": True})

    def test_legacy_headers_do_not_create_gateway_state(self):
        body, headers = main.make_request("tools/list", 1)
        headers["Mcp-Session-Id"] = "ignored"
        headers["Last-Event-ID"] = "ignored"
        status, response = self.gateway.handle("bearer-alice", body, headers)
        self.assertEqual(status, 200)
        self.assertIn("tools", response["result"])
        self.assertFalse(hasattr(self.gateway, "sessions"))


if __name__ == "__main__":
    unittest.main()
