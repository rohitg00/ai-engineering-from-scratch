"""Tests for the stateless MCP Apps lesson server."""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson14_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class McpAppsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.McpAppServer()

    def call(self, method, params=None, *, apps=True, request_id=1):
        body, headers = main.make_request(method, request_id, params, apps=apps)
        return self.server.handle(body, headers)

    def test_discover_advertises_apps_extension(self):
        status, response = self.call("server/discover")
        self.assertEqual(status, 200)
        result = response["result"]
        self.assertIn(main.APPS_EXTENSION, result["capabilities"]["extensions"])
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])

    def test_tools_list_declares_ui_before_call(self):
        _, response = self.call("tools/list")
        assert response is not None
        tool = response["result"]["tools"][0]
        self.assertEqual(tool["_meta"]["ui"]["resourceUri"], main.RESOURCE_URI)
        self.assertEqual(tool["inputSchema"]["type"], "object")

    def test_resources_list_is_complete_cacheable_and_deterministic(self):
        _, first = self.call("resources/list")
        _, second = self.call("resources/list", request_id=2)
        assert first is not None and second is not None
        result = first["result"]
        self.assertEqual(result["resources"], second["result"]["resources"])
        self.assertEqual(result["resources"][0]["uri"], main.RESOURCE_URI)
        self.assertEqual(result["resources"][0]["mimeType"], main.RESOURCE_MIME)
        self.assertEqual(result["resultType"], "complete")
        self.assertGreater(result["ttlMs"], 0)
        self.assertEqual(result["cacheScope"], "public")
        self.assertEqual(result["_meta"][main.SERVER_INFO_META], main.SERVER_INFO)

    def test_non_apps_client_gets_text_tool_fallback(self):
        _, response = self.call("tools/list", apps=False)
        self.assertNotIn("_meta", response["result"]["tools"][0])

    def test_resource_requires_apps_capability(self):
        status, response = self.call("resources/read", {"uri": main.RESOURCE_URI}, apps=False)
        self.assertEqual(status, 400)
        assert response is not None
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"],
            {
                "requiredCapabilities": {
                    "extensions": {main.APPS_EXTENSION: {}}
                }
            },
        )

    def test_malformed_extension_map_does_not_grant_apps_capability(self):
        body, headers = main.make_request(
            "resources/read",
            1,
            {"uri": main.RESOURCE_URI},
        )
        body["params"]["_meta"][main.CLIENT_CAPABILITIES_META]["extensions"] = [
            main.APPS_EXTENSION
        ]
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32021)

    def test_resource_has_mime_cache_and_safe_bridge_origin(self):
        _, response = self.call("resources/read", {"uri": main.RESOURCE_URI})
        result = response["result"]
        resource = result["contents"][0]
        self.assertEqual(resource["mimeType"], "text/html;profile=mcp-app")
        self.assertEqual(result["cacheScope"], "public")
        self.assertIn(f"const hostOrigin = \"{main.HOST_ORIGIN}\"", resource["text"])
        self.assertIn("event.origin !== hostOrigin", resource["text"])
        self.assertIn("appCapabilities: {}", resource["text"])
        self.assertIn('method: "ui/notifications/initialized"', resource["text"])
        self.assertNotIn("}, '*')", resource["text"])

    def test_header_body_mismatch_is_protocol_error(self):
        body, headers = main.make_request("tools/call", 1, {"name": "notes_timeline"})
        headers["Mcp-Name"] = "other_tool"
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 400)
        assert response is not None
        self.assertEqual(response["error"]["code"], -32020)

    def test_header_version_mismatch_precedes_version_support_check(self):
        body, headers = main.make_request("tools/list", 1)
        body["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 400)
        assert response is not None
        self.assertEqual(response["error"]["code"], -32020)

    def test_unsupported_version_has_exact_error_data(self):
        body, headers = main.make_request("tools/list", 1)
        requested = "2025-11-25"
        body["params"]["_meta"][main.PROTOCOL_META] = requested
        headers["MCP-Protocol-Version"] = requested
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 400)
        assert response is not None
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": requested},
        )

    def test_unknown_method_is_json_rpc_404(self):
        body, headers = main.make_request("widgets/list", 91)
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 404)
        self.assertEqual(
            response,
            {
                "jsonrpc": "2.0",
                "id": 91,
                "error": {"code": -32601, "message": "Method not found"},
            },
        )

    def test_accepted_notification_returns_202_with_empty_body(self):
        body, headers = main.make_request("resources/list", 1)
        del body["id"]
        status, response = self.server.handle(body, headers)
        self.assertEqual(status, 202)
        self.assertIsNone(response)

    def test_get_and_delete_are_not_transport_entrypoints(self):
        body, headers = main.make_request("server/discover", 1)
        self.assertEqual(self.server.handle(body, headers, http_method="GET"), (405, None))
        self.assertEqual(self.server.handle(body, headers, http_method="DELETE"), (405, None))

    def test_tool_result_has_server_identity(self):
        _, response = self.call("tools/call", {"name": "notes_timeline", "arguments": {}})
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(
            response["result"]["_meta"][main.SERVER_INFO_META],
            main.SERVER_INFO,
        )


if __name__ == "__main__":
    unittest.main()
