import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class McpFundamentalsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.MockClient(server=main.build_weather_server())

    def test_handshake_echoes_negotiated_protocol_version(self) -> None:
        response = self.client.initialize()
        self.assertEqual(response["result"]["protocolVersion"], main.PROTOCOL_VERSION)
        self.assertIn("tools", response["result"]["capabilities"])

    def test_discovery_lists_every_registered_tool_with_schema(self) -> None:
        tools = self.client.list_tools()
        self.assertEqual([tool["name"] for tool in tools], ["get_forecast"])
        self.assertIn("inputSchema", tools[0])
        self.assertIn("city", tools[0]["inputSchema"]["properties"])

    def test_valid_call_returns_a_result(self) -> None:
        response = self.client.call_tool("get_forecast", {"city": "Amsterdam"})
        self.assertNotIn("error", response)
        self.assertIn("Amsterdam", response["result"]["content"][0]["text"])

    def test_unknown_tool_returns_structured_error_not_crash(self) -> None:
        response = self.client.call_tool("delete_everything", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_missing_required_argument_is_rejected(self) -> None:
        response = self.client.call_tool("get_forecast", {})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_malformed_request_is_rejected_by_the_server(self) -> None:
        server = main.build_weather_server()
        response = server.handle({"method": "tools/list", "id": 1})
        self.assertEqual(response["error"]["code"], main.INVALID_REQUEST)

    def test_response_id_matches_request_id(self) -> None:
        response = self.client.initialize()
        self.assertEqual(response["id"], 1)


if __name__ == "__main__":
    unittest.main()
