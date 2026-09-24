import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class SchemasAndStructuredDataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.MockClient(server=main.build_ticket_server())

    def test_handshake_echoes_negotiated_protocol_version(self) -> None:
        response = self.client.initialize()
        self.assertEqual(response["result"]["protocolVersion"], main.PROTOCOL_VERSION)

    def test_discovery_returns_tool_with_typed_schema_and_required_list(self) -> None:
        tools = self.client.list_tools()
        schema = tools[0]["inputSchema"]
        self.assertEqual(tools[0]["name"], "create_ticket")
        self.assertEqual(schema["properties"]["priority"]["type"], "string")
        self.assertIn("title", schema["required"])
        self.assertIn("priority", schema["required"])

    def test_valid_arguments_pass_validation(self) -> None:
        response = self.client.call_tool(
            "create_ticket", {"title": "Printer offline", "priority": "medium", "points": 2}
        )
        self.assertNotIn("error", response)

    def test_missing_required_field_is_rejected_with_invalid_params(self) -> None:
        response = self.client.call_tool("create_ticket", {"title": "No priority set"})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn("priority", response["error"]["message"])

    def test_wrong_typed_field_is_rejected_with_invalid_params(self) -> None:
        response = self.client.call_tool(
            "create_ticket", {"title": "Points as text", "priority": "low", "points": "five"}
        )
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn("points", response["error"]["message"])

    def test_enum_violation_is_rejected_with_invalid_params(self) -> None:
        response = self.client.call_tool(
            "create_ticket", {"title": "Priority out of range", "priority": "urgent"}
        )
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn("priority", response["error"]["message"])

    def test_valid_call_returns_structured_result(self) -> None:
        response = self.client.call_tool(
            "create_ticket", {"title": "Structured result check", "priority": "high", "points": 5}
        )
        payload = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(payload["title"], "Structured result check")
        self.assertEqual(payload["priority"], "high")
        self.assertEqual(payload["points"], 5)

    def test_unknown_tool_returns_method_not_found(self) -> None:
        response = self.client.call_tool("delete_all_tickets", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_response_id_matches_request_id(self) -> None:
        first = self.client.initialize()
        second = self.client._request("tools/list")
        self.assertEqual(first["id"], 1)
        self.assertEqual(second["id"], 2)


if __name__ == "__main__":
    unittest.main()
