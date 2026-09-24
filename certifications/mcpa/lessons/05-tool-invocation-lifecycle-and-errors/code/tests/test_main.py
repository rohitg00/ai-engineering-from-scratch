import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ToolInvocationLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_lifecycle_server()

    def test_malformed_json_returns_parse_error(self) -> None:
        response = self.server.handle_raw("{not valid json")
        self.assertEqual(response["error"]["code"], main.PARSE_ERROR)
        self.assertIsNone(response["id"])

    def test_envelope_missing_required_fields_returns_invalid_request(self) -> None:
        response = self.server.handle({"method": "tools/call"})
        self.assertEqual(response["error"]["code"], main.INVALID_REQUEST)

    def test_unknown_tool_returns_method_not_found(self) -> None:
        response = self.server.handle({
            "jsonrpc": "2.0", "id": "probe", "method": "tools/call",
            "params": {"name": "delete_everything", "arguments": {}},
        })
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertEqual(response["id"], "probe")

    def test_missing_required_argument_returns_invalid_params(self) -> None:
        response = self.server.handle({
            "jsonrpc": "2.0", "id": "probe", "method": "tools/call",
            "params": {"name": "convert_temperature", "arguments": {}},
        })
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(response["id"], "probe")

    def test_non_object_arguments_returns_invalid_params(self) -> None:
        response = self.server.handle({
            "jsonrpc": "2.0", "id": "probe", "method": "tools/call",
            "params": {"name": "convert_temperature", "arguments": "not-an-object"},
        })
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_handler_exception_returns_internal_error(self) -> None:
        response = self.server.handle({
            "jsonrpc": "2.0", "id": "probe", "method": "tools/call",
            "params": {"name": "divide", "arguments": {"a": 1, "b": 0}},
        })
        self.assertEqual(response["error"]["code"], main.INTERNAL_ERROR)
        self.assertEqual(response["id"], "probe")

    def test_valid_call_returns_a_result(self) -> None:
        response = self.server.handle({
            "jsonrpc": "2.0", "id": "probe", "method": "tools/call",
            "params": {"name": "convert_temperature", "arguments": {"celsius": 0}},
        })
        self.assertNotIn("error", response)
        self.assertIn("32", response["result"]["content"][0]["text"])

    def test_request_id_is_preserved_across_every_failing_stage(self) -> None:
        cases = [
            {"jsonrpc": "2.0", "id": 555, "method": "tools/call",
             "params": {"name": "missing_tool", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 555, "method": "tools/call",
             "params": {"name": "convert_temperature", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 555, "method": "tools/call",
             "params": {"name": "divide", "arguments": {"a": 1, "b": 0}}},
            {"jsonrpc": "2.0", "id": 555, "method": "tools/call",
             "params": {"name": "convert_temperature", "arguments": {"celsius": 10}}},
        ]
        for request in cases:
            response = self.server.handle(request)
            self.assertEqual(response["id"], 555)


if __name__ == "__main__":
    unittest.main()
