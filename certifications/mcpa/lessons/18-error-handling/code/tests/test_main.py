import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ErrorHandlingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.Client(main.Server())

    def test_unknown_tool_is_invalid_params(self) -> None:
        response = self.client.call("delete_everything", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unknown_method_is_method_not_found_mapped_to_http_404(self) -> None:
        response = self.client.send("resources/list")
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertEqual(main.HTTP_STATUS_FOR_CODE[response["error"]["code"]], 404)

    def test_missing_required_argument_is_a_tool_execution_error(self) -> None:
        response = self.client.call("close_ticket", {"ticket_id": "TCK-1"})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("resolution", response["result"]["content"][0]["text"])

    def test_invalid_enum_argument_is_a_tool_execution_error_not_a_protocol_error(self) -> None:
        response = self.client.call("close_ticket", {"ticket_id": "TCK-1", "resolution": "escalate"})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])

    def test_missing_meta_is_invalid_params_mapped_to_http_400(self) -> None:
        response = self.client.server.handle({"jsonrpc": "2.0", "id": 50, "method": "tools/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(main.HTTP_STATUS_FOR_CODE[response["error"]["code"]], 400)

    def test_unsupported_version_carries_supported_and_requested(self) -> None:
        response = self.client.send("tools/list", version="2024-11-05")
        error = response["error"]
        self.assertEqual(error["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(error["data"]["supported"], [main.PROTOCOL_VERSION])
        self.assertEqual(error["data"]["requested"], "2024-11-05")

    def test_missing_capability_carries_required_capabilities(self) -> None:
        response = self.client.call("archive_workspace", {"workspace_id": "ws-1"}, capabilities={})
        error = response["error"]
        self.assertEqual(error["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("elicitation", error["data"]["requiredCapabilities"])

    def test_declared_capability_allows_the_call_to_succeed(self) -> None:
        response = self.client.call("archive_workspace", {"workspace_id": "ws-1"}, capabilities={"elicitation": {}})
        self.assertNotIn("error", response)
        self.assertFalse(response["result"]["isError"])

    def test_guard_refuses_legacy_code_32001(self) -> None:
        with self.assertRaises(main.ForbiddenErrorCode):
            main.safe_error(1, -32001, "tool call failed")

    def test_guard_refuses_retired_resource_not_found_code_32002(self) -> None:
        with self.assertRaises(main.ForbiddenErrorCode):
            main.safe_error(1, -32002, "resource not found")

    def test_guard_refuses_retired_url_elicitation_code_32042(self) -> None:
        with self.assertRaises(main.ForbiddenErrorCode):
            main.safe_error(1, -32042, "url elicitation required")

    def test_guard_refuses_an_undefined_reserved_code(self) -> None:
        with self.assertRaises(main.ForbiddenErrorCode):
            main.safe_error(1, -32090, "made up reserved code")

    def test_guard_allows_the_three_defined_reserved_codes(self) -> None:
        for code in (main.HEADER_MISMATCH, main.MISSING_REQUIRED_CLIENT_CAPABILITY, main.UNSUPPORTED_PROTOCOL_VERSION):
            self.assertFalse(main.is_forbidden_error_code(code))
            main.safe_error(1, code, "defined reserved code")

    def test_guard_allows_application_codes_outside_the_reserved_range(self) -> None:
        response = main.safe_error(1, -40000, "an application-defined code well outside -32768 to -32000")
        self.assertEqual(response["error"]["code"], -40000)

    def test_parse_error_has_a_null_id(self) -> None:
        response = main.parse_client_message("{not valid json")
        self.assertIsNone(response["id"])
        self.assertEqual(response["error"]["code"], main.PARSE_ERROR)

    def test_transcript_never_carries_a_forbidden_code_outside_a_violation_wrapper(self) -> None:
        for entry in main.transcript():
            if not isinstance(entry, dict):
                continue
            if "violation" in entry:
                continue
            error = entry.get("error")
            if error is None and "message" in entry and isinstance(entry["message"], dict):
                error = entry["message"].get("error")
            if isinstance(error, dict):
                self.assertFalse(main.is_forbidden_error_code(error.get("code")))


if __name__ == "__main__":
    unittest.main()
