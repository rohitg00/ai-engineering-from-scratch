import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ResourcePromptTests(unittest.TestCase):
    def result(self, request):
        response = main.handle(request)
        self.assertIsInstance(response, dict)
        self.assertNotIn("error", response)
        return response["result"]

    def test_resource_list_is_deterministic(self):
        first = self.result(main.rpc_request(1, "resources/list"))
        second = self.result(main.rpc_request(2, "resources/list"))
        self.assertEqual(first["resources"], second["resources"])
        self.assertEqual([item["uri"] for item in first["resources"]], sorted(main.NOTES))

    def test_server_discover_advertises_current_capabilities(self):
        result = self.result(main.rpc_request(0, "server/discover"))
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(
            set(result["capabilities"]),
            {"resources", "prompts"},
        )
        self.assertTrue(result["capabilities"]["resources"]["subscribe"])

    def test_missing_protocol_version_is_invalid_params(self):
        request = main.rpc_request(0, "resources/list")
        del request["params"]["_meta"]["io.modelcontextprotocol/protocolVersion"]
        response = main.handle(request)
        self.assertEqual(response["error"]["code"], -32602)

    def test_unsupported_version_uses_current_protocol_error(self):
        request = main.rpc_request(0, "resources/list")
        request["params"]["_meta"][
            "io.modelcontextprotocol/protocolVersion"
        ] = "2025-11-25"
        response = main.handle(request)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(response["error"]["data"]["supported"], [main.PROTOCOL_VERSION])
        self.assertEqual(response["error"]["data"]["requested"], "2025-11-25")

    def test_resource_list_has_public_cache_hints(self):
        result = self.result(main.rpc_request(1, "resources/list"))
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["ttlMs"], 300_000)
        self.assertEqual(result["cacheScope"], "public")

    def test_resource_read_has_private_cache_hints(self):
        result = self.result(main.rpc_request(1, "resources/read", uri="notes://note-1"))
        self.assertEqual(result["ttlMs"], 60_000)
        self.assertEqual(result["cacheScope"], "private")

    def test_unknown_resource_uses_invalid_params(self):
        response = main.handle(main.rpc_request(1, "resources/read", uri="notes://missing"))
        self.assertEqual(response["error"]["code"], -32602)

    def test_prompt_list_is_deterministic_and_cacheable(self):
        result = self.result(main.rpc_request(1, "prompts/list"))
        self.assertEqual([item["name"] for item in result["prompts"]], sorted(main.PROMPTS))
        self.assertEqual((result["ttlMs"], result["cacheScope"]), (600_000, "public"))

    def test_prompt_get_validates_required_argument(self):
        response = main.handle(main.rpc_request(1, "prompts/get", name="release_brief", arguments={}))
        self.assertEqual(response["error"]["code"], -32602)

    def test_subscription_acknowledgment_is_first_message(self):
        stream = main.handle(
            main.rpc_request(
                17,
                "subscriptions/listen",
                notifications={"resourceSubscriptions": ["notes://note-1"]},
            )
        )
        self.assertIsInstance(stream, main.SubscriptionStream)
        acknowledgment = stream.acknowledged()
        self.assertEqual(acknowledgment["method"], "notifications/subscriptions/acknowledged")
        self.assertEqual(acknowledgment["params"]["_meta"]["io.modelcontextprotocol/subscriptionId"], 17)

    def test_subscription_filters_and_correlates_updates(self):
        stream = main.subscriptions_listen(
            22, {"notifications": {"resourceSubscriptions": ["notes://note-1"]}}
        )
        self.assertIsNone(stream.resource_updated("notes://note-2"))
        event = stream.resource_updated("notes://note-1")
        self.assertEqual(event["params"]["_meta"]["io.modelcontextprotocol/subscriptionId"], 22)

    def test_legacy_subscription_methods_are_not_exposed(self):
        self.assertNotIn("resources/subscribe", main.HANDLERS)
        self.assertNotIn("resources/unsubscribe", main.HANDLERS)

    def test_every_complete_result_identifies_server(self):
        result = self.result(main.rpc_request(1, "resources/list"))
        self.assertEqual(result["_meta"]["io.modelcontextprotocol/serverInfo"], main.SERVER_INFO)

    def test_json_rpc_notification_receives_no_response(self):
        request = main.rpc_request(1, "resources/list")
        del request["id"]
        self.assertIsNone(main.handle(request))


if __name__ == "__main__":
    unittest.main()
