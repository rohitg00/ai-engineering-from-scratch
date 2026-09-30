import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class JsonRpcAndMetaTests(unittest.TestCase):
    def test_classify_identifies_all_four_message_shapes(self) -> None:
        request = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {}}
        notification = {"jsonrpc": "2.0", "method": "notifications/progress", "params": {}}
        result = {"jsonrpc": "2.0", "id": 1, "result": {"resultType": "complete"}}
        error = {"jsonrpc": "2.0", "id": 1, "error": {"code": main.INVALID_PARAMS, "message": "bad"}}
        self.assertEqual(main.classify_message(request), "request")
        self.assertEqual(main.classify_message(notification), "notification")
        self.assertEqual(main.classify_message(result), "result")
        self.assertEqual(main.classify_message(error), "error")

    def test_null_request_id_is_classified_invalid(self) -> None:
        message = {"jsonrpc": "2.0", "id": None, "method": "tools/call", "params": {}}
        self.assertEqual(main.classify_message(message), "invalid")

    def test_notification_with_an_id_is_rejected_by_shape_validation(self) -> None:
        message = {"jsonrpc": "2.0", "id": 99, "method": "notifications/progress", "params": {}}
        self.assertEqual(main.classify_message(message), "request")
        problems = main.validate_notification_shape(message)
        self.assertTrue(any("must not include an id" in problem for problem in problems))

    def test_result_without_result_type_is_rejected(self) -> None:
        missing = {"jsonrpc": "2.0", "id": 1, "result": {}}
        present = {"jsonrpc": "2.0", "id": 1, "result": {"resultType": "complete"}}
        self.assertTrue(main.validate_result_shape(missing))
        self.assertEqual(main.validate_result_shape(present), [])

    def test_error_without_code_or_message_is_rejected(self) -> None:
        missing = {"jsonrpc": "2.0", "id": 1, "error": {}}
        present = {"jsonrpc": "2.0", "id": 1, "error": {"code": main.INVALID_PARAMS, "message": "bad"}}
        self.assertTrue(main.validate_error_shape(missing))
        self.assertEqual(main.validate_error_shape(present), [])

    def test_reserved_meta_prefix_detection(self) -> None:
        self.assertEqual(main.meta_key_status("io.modelcontextprotocol/protocolVersion"), "reserved")
        self.assertEqual(main.meta_key_status("dev.mcp/experimentalHint"), "reserved")
        self.assertEqual(main.meta_key_status("com.example.mcp/scanId"), "free")

    def test_bare_reserved_meta_keys(self) -> None:
        for key in ("progressToken", "traceparent", "tracestate", "baggage"):
            self.assertEqual(main.meta_key_status(key), "reserved")

    def test_malformed_meta_key_is_invalid(self) -> None:
        self.assertEqual(main.meta_key_status("9invalid/name"), "invalid")

    def test_missing_protocol_version_returns_invalid_params(self) -> None:
        message = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "get_weather",
                "arguments": {"location": "Pune"},
                "_meta": {main.CAPS_KEY: {}},
            },
        }
        response = main.handle_request(message)
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn(main.PV_KEY, response["error"]["message"])

    def test_missing_client_capabilities_returns_invalid_params(self) -> None:
        message = {
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "get_weather",
                "arguments": {"location": "Pune"},
                "_meta": {main.PV_KEY: main.PROTOCOL_VERSION},
            },
        }
        response = main.handle_request(message)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertIn(main.CAPS_KEY, response["error"]["message"])

    def test_well_formed_request_returns_a_complete_result(self) -> None:
        request = main.make_request(1, "tools/call", {"name": "get_weather", "arguments": {"location": "Pune"}})
        response = main.handle_request(request)
        self.assertNotIn("error", response)
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertIsInstance(response["result"]["content"], list)

    def test_every_unwrapped_result_in_the_transcript_carries_a_result_type(self) -> None:
        for entry in main.transcript():
            if isinstance(entry, dict) and "result" in entry:
                self.assertIn("resultType", entry["result"])


if __name__ == "__main__":
    unittest.main()
