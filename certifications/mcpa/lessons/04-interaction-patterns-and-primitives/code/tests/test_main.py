import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class InteractionPatternsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_demo_server()
        self.client = main.MockClient(server=self.server)

    def test_request_yields_a_response(self) -> None:
        response = self.client.initialize()
        self.assertIn("result", response)
        self.assertEqual(response["result"]["protocolVersion"], main.PROTOCOL_VERSION)

    def test_notification_yields_no_response(self) -> None:
        response = self.server.dispatch({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self.assertIsNone(response)

    def test_response_id_echoes_the_request_id(self) -> None:
        response = self.server.dispatch({"jsonrpc": "2.0", "id": 42, "method": "tools/list"})
        self.assertEqual(response["id"], 42)

    def test_list_tools_returns_the_declared_set(self) -> None:
        tools = self.client.list_tools()
        self.assertEqual([tool["name"] for tool in tools], ["add"])
        self.assertIn("inputSchema", tools[0])

    def test_list_resources_returns_the_declared_set(self) -> None:
        resources = self.client.list_resources()
        self.assertEqual([resource["uri"] for resource in resources], ["notes://overview"])

    def test_list_prompts_returns_the_declared_set(self) -> None:
        prompts = self.client.list_prompts()
        self.assertEqual([prompt["name"] for prompt in prompts], ["greet_user"])
        self.assertIn("arguments", prompts[0])

    def test_unknown_method_on_a_request_returns_method_not_found(self) -> None:
        response = self.server.dispatch({"jsonrpc": "2.0", "id": 9, "method": "widgets/list"})
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_unknown_method_on_a_notification_returns_nothing(self) -> None:
        response = self.server.dispatch({"jsonrpc": "2.0", "method": "widgets/list"})
        self.assertIsNone(response)

    def test_tool_call_missing_required_argument_returns_invalid_params(self) -> None:
        response = self.client.call_tool("add", {"a": 1})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_malformed_request_without_method_is_rejected(self) -> None:
        response = self.server.dispatch({"jsonrpc": "2.0", "id": 1})
        self.assertEqual(response["error"]["code"], main.INVALID_REQUEST)

    def test_resource_read_returns_content_for_a_known_uri(self) -> None:
        response = self.client.read_resource("notes://overview")
        self.assertIn("contents", response["result"])
        self.assertEqual(response["result"]["contents"][0]["uri"], "notes://overview")

    def test_prompt_get_renders_messages_for_a_known_prompt(self) -> None:
        response = self.client.get_prompt("greet_user", {"name": "Ada"})
        text = response["result"]["messages"][0]["content"]["text"]
        self.assertIn("Ada", text)


if __name__ == "__main__":
    unittest.main()
