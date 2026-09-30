import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ExtensionNegotiatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_server()
        self.client = main.Client(self.server)

    def test_identifier_validation_accepts_official_and_third_party_ids(self) -> None:
        self.assertTrue(main.is_well_formed_extension_id("io.modelcontextprotocol/tasks"))
        self.assertTrue(main.is_well_formed_extension_id("com.example/x"))

    def test_identifier_validation_rejects_missing_prefix(self) -> None:
        self.assertFalse(main.is_well_formed_extension_id("tasks"))
        self.assertFalse(main.is_well_formed_extension_id("/tasks"))
        self.assertFalse(main.is_well_formed_extension_id("no-slash-at-all"))

    def test_negotiation_is_the_intersection_of_both_declarations(self) -> None:
        active = main.negotiate_extensions(
            {main.PRIORITY_EXTENSION: {"tier": "gold"}, main.EXPORT_EXTENSION: {}},
            {main.PRIORITY_EXTENSION: {}},
        )
        self.assertEqual(set(active), {main.PRIORITY_EXTENSION})
        self.assertEqual(active[main.PRIORITY_EXTENSION], {"tier": "gold"})

    def test_fallback_to_core_when_client_does_not_declare_the_extension(self) -> None:
        response = self.client.send("tools/call", {"name": "summarize_incidents", "arguments": {}})
        self.assertEqual(response["result"]["structuredContent"], {"open": 3})
        self.assertNotIn("tier", response["result"]["structuredContent"])

    def test_empty_settings_object_still_counts_as_supported(self) -> None:
        response = self.client.send(
            "tools/call", {"name": "summarize_incidents", "arguments": {}},
            capabilities={"extensions": {main.PRIORITY_EXTENSION: {}}},
        )
        self.assertEqual(response["result"]["structuredContent"]["tier"], "standard")

    def test_settings_object_configures_the_active_extension(self) -> None:
        response = self.client.send(
            "tools/call", {"name": "summarize_incidents", "arguments": {}},
            capabilities={"extensions": {main.PRIORITY_EXTENSION: {"tier": "gold"}}},
        )
        self.assertEqual(response["result"]["structuredContent"]["tier"], "gold")

    def test_mandatory_extension_missing_is_rejected(self) -> None:
        response = self.client.send("tools/call", {"name": "export_dataset", "arguments": {"dataset": "incidents"}})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertEqual(
            response["error"]["data"]["requiredCapabilities"],
            {"extensions": {main.EXPORT_EXTENSION: {}}},
        )

    def test_mandatory_extension_declared_lets_the_call_complete(self) -> None:
        response = self.client.send(
            "tools/call", {"name": "export_dataset", "arguments": {"dataset": "incidents"}},
            capabilities={"extensions": {main.EXPORT_EXTENSION: {}}},
        )
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["structuredContent"]["accepted"])

    def test_malformed_identifier_never_activates_even_if_both_sides_list_it(self) -> None:
        active = main.negotiate_extensions(
            {"no-slash-here": {}, main.PRIORITY_EXTENSION: {"tier": "silver"}},
            {"no-slash-here": {}, main.PRIORITY_EXTENSION: {}},
        )
        self.assertNotIn("no-slash-here", active)
        self.assertIn(main.PRIORITY_EXTENSION, active)

    def test_discover_advertises_extensions_with_cache_hints(self) -> None:
        result = self.client.send("server/discover")["result"]
        self.assertEqual(
            set(result["capabilities"]["extensions"]),
            {main.PRIORITY_EXTENSION, main.EXPORT_EXTENSION},
        )
        self.assertEqual(result["cacheScope"], "public")
        self.assertGreaterEqual(result["ttlMs"], 0)

    def test_unknown_tool_is_a_protocol_error_not_a_capability_error(self) -> None:
        response = self.client.send("tools/call", {"name": "purge_everything", "arguments": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_every_request_carries_version_and_capabilities(self) -> None:
        self.client.send("server/discover")
        self.client.send("tools/call", {"name": "summarize_incidents", "arguments": {}})
        for message in self.client.log:
            if "method" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
