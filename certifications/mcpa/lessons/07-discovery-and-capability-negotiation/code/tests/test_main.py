import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class DiscoveryAndCapabilityNegotiationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.Client(main.DeployServer())

    def test_discover_returns_supported_versions_and_capabilities_with_cache_hints(self) -> None:
        result = self.client.discover()["result"]
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        for key in ("tools", "resources", "prompts", "completions", "logging", "extensions"):
            self.assertIn(key, result["capabilities"])
        self.assertGreaterEqual(result["ttlMs"], 0)
        self.assertIn(result["cacheScope"], {"public", "private"})

    def test_discover_result_carries_instructions_and_server_identity(self) -> None:
        result = self.client.discover()["result"]
        self.assertTrue(result["instructions"])
        self.assertEqual(result["_meta"][main.SERVER_INFO_KEY]["name"], "deploy-console")

    def test_call_without_elicitation_capability_is_missing_capability_error(self) -> None:
        response = self.client.call("notify_oncall", {"message": "db failover"}, capabilities={})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("elicitation", response["error"]["data"]["requiredCapabilities"])

    def test_call_with_elicitation_capability_declared_succeeds(self) -> None:
        response = self.client.call(
            "notify_oncall", {"message": "db failover"}, capabilities={"elicitation": {"form": {}}}
        )
        self.assertNotIn("error", response)
        self.assertFalse(response["result"]["isError"])
        self.assertIn("db failover", response["result"]["content"][0]["text"])

    def test_tool_without_required_capabilities_needs_no_declaration(self) -> None:
        response = self.client.call("list_incidents", {}, capabilities={})
        self.assertNotIn("error", response)
        self.assertFalse(response["result"]["isError"])

    def test_unsupported_version_names_supported_and_requested(self) -> None:
        response = self.client.discover(version="2025-11-25")
        error = response["error"]
        self.assertEqual(error["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(error["data"]["supported"], [main.PROTOCOL_VERSION])
        self.assertEqual(error["data"]["requested"], "2025-11-25")

    def test_client_retries_discover_with_a_version_from_supported_list(self) -> None:
        first = self.client.discover(version="2025-11-25")
        first_id = first["id"]
        supported_version = first["error"]["data"]["supported"][0]
        second = self.client.discover(version=supported_version)
        self.assertNotEqual(second["id"], first_id)
        self.assertEqual(second["result"]["resultType"], "complete")

    def test_unknown_tool_is_invalid_params_not_missing_capability(self) -> None:
        response = self.client.call("close_all_incidents", {}, capabilities={"elicitation": {"form": {}}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unknown_method_is_method_not_found_not_invalid_params(self) -> None:
        response = self.client.send("resources/list")
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_every_request_carries_protocol_version_and_capabilities(self) -> None:
        self.client.discover()
        self.client.call("notify_oncall", {"message": "x"}, capabilities={"elicitation": {"form": {}}})
        requests = [message for message in self.client.log if "method" in message]
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertIn(main.PV_KEY, meta)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_request_missing_meta_is_rejected_with_invalid_params(self) -> None:
        server = main.DeployServer()
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)


if __name__ == "__main__":
    unittest.main()
