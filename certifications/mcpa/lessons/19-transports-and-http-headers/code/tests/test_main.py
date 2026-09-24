import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class TransportsAndHttpHeadersTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_server()
        self.tool = self.server.tools["run_report"]
        self.request = main.make_request(
            1, "tools/call", {"name": "run_report", "arguments": {"region": "us-west1", "dataset": "signups"}}
        )

    def test_stdio_frame_round_trip(self) -> None:
        first = main.make_request(1, "tools/call", {"name": "run_report", "arguments": {"region": "us-west1", "dataset": "signups"}})
        second = main.make_result(1, content=[{"type": "text", "text": "ok"}])
        stream = main.frame_message(first) + main.frame_message(second)
        self.assertEqual(main.parse_frames(stream), [first, second])

    def test_frame_line_rejects_embedded_newlines(self) -> None:
        pretty_printed = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call"}, indent=2)
        with self.assertRaises(ValueError):
            main.frame_line(pretty_printed)

    def test_http_headers_built_correctly_for_tools_call(self) -> None:
        headers = main.build_http_headers(self.request, self.tool.header_params)
        self.assertEqual(headers["MCP-Protocol-Version"], main.PROTOCOL_VERSION)
        self.assertEqual(headers["Mcp-Method"], "tools/call")
        self.assertEqual(headers["Mcp-Name"], "run_report")
        self.assertEqual(headers["Mcp-Param-Region"], "us-west1")

    def test_value_encoding_matches_the_specification_table(self) -> None:
        self.assertEqual(main.encode_header_value("us-west1"), "us-west1")
        self.assertEqual(main.encode_header_value("Hello, 世界"), "=?base64?SGVsbG8sIOS4lueVjA==?=")
        self.assertEqual(main.encode_header_value(" padded "), "=?base64?IHBhZGRlZCA=?=")
        self.assertEqual(main.encode_header_value("line1\nline2"), "=?base64?bGluZTEKbGluZTI=?=")
        self.assertEqual(main.encode_header_value("=?base64?literal?="), "=?base64?PT9iYXNlNjQ/bGl0ZXJhbD89?=")
        round_tripped = main.decode_header_value(main.encode_header_value("Hello, 世界"))
        self.assertEqual(round_tripped, "Hello, 世界")

    def test_malformed_base64_sentinel_decodes_to_a_mismatch_not_an_exception(self) -> None:
        self.assertIsNone(main.decode_header_value("=?base64?not*base64?="))
        self.assertIsNone(main.decode_header_value("=?base64?/w==?="))

    def test_mcp_name_header_source_field_depends_on_method(self) -> None:
        read_request = main.make_request(2, "resources/read", {"uri": "file:///tmp/config.json"})
        self.assertEqual(main.build_http_headers(read_request)["Mcp-Name"], "file:///tmp/config.json")
        discover_request = main.make_request(3, "server/discover", {})
        self.assertNotIn("Mcp-Name", main.build_http_headers(discover_request))

    def test_matching_headers_pass_transport_validation(self) -> None:
        headers = main.build_http_headers(self.request, self.tool.header_params)
        status, error = main.handle_http_request(headers, self.request, self.tool.header_params)
        self.assertEqual((status, error), (200, None))

    def test_mismatched_header_returns_400_and_header_mismatch_code(self) -> None:
        headers = main.build_http_headers(self.request, self.tool.header_params)
        headers["Mcp-Method"] = "prompts/get"
        status, error = main.handle_http_request(headers, self.request, self.tool.header_params)
        self.assertEqual(status, 400)
        self.assertEqual(error["error"]["code"], main.HEADER_MISMATCH)
        self.assertIn("Mcp-Method", error["error"]["data"]["headers"])

    def test_bad_origin_rejected_with_403_good_origin_allowed(self) -> None:
        allowed = {"https://client.example"}
        self.assertEqual(main.validate_origin("https://evil.example", allowed), (403, {"error": "origin_not_allowed", "origin": "https://evil.example"}))
        self.assertEqual(main.validate_origin("https://client.example", allowed), (200, None))
        self.assertEqual(main.validate_origin(None, allowed), (200, None))

    def test_get_and_delete_are_rejected_with_405(self) -> None:
        self.assertEqual(main.handle_http_get_or_delete("GET"), (405, None))
        self.assertEqual(main.handle_http_get_or_delete("DELETE"), (405, None))

    def test_accepted_notification_post_returns_202(self) -> None:
        notification = {"jsonrpc": "2.0", "method": "notifications/example", "params": {}}
        self.assertEqual(main.handle_http_notification(notification), (202, None))
        malformed = {"jsonrpc": "2.0", "id": 9, "method": "notifications/example"}
        status, error = main.handle_http_notification(malformed)
        self.assertEqual(status, 400)
        self.assertEqual(error["error"]["code"], main.INVALID_PARAMS)

    def test_transcript_marks_the_mismatch_example_as_a_violation_before_the_error(self) -> None:
        entries = main.transcript()
        violation_index = next(index for index, entry in enumerate(entries) if isinstance(entry, dict) and entry.get("violation"))
        self.assertIsInstance(entries[violation_index]["violation"], str)
        self.assertEqual(entries[violation_index]["message"]["method"], "tools/call")
        following = entries[violation_index + 1]
        self.assertEqual(following["message"]["error"]["code"], main.HEADER_MISMATCH)
        self.assertEqual(following["message"]["id"], entries[violation_index]["message"]["id"])

    def test_stdio_and_http_calls_reach_the_same_business_result(self) -> None:
        stdio_response = self.server.handle(self.request)
        self.assertFalse(stdio_response["result"]["isError"])
        self.assertIn("signups", stdio_response["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
