"""Deterministic tests for MCP tool contracts and content."""

from __future__ import annotations

import base64
import importlib.util
import json
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson28_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class ToolContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.ContractServer()
        self.client = main.ContractClient(self.server)

    def test_discovery_declares_tools_and_completions(self) -> None:
        response = self.server.dispatch(main.make_request(1, "server/discover", {}))
        result = response["result"]
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertIn("tools", result["capabilities"])
        self.assertIn("completions", result["capabilities"])
        self.assertEqual(result["resultType"], "complete")

    def test_every_request_requires_its_own_metadata(self) -> None:
        good = self.server.dispatch(main.make_request(1, "tools/list", {}))
        self.assertIn("result", good)
        missing = main.make_request(2, "tools/list", {})
        del missing["params"]["_meta"]
        rejected = self.server.dispatch(missing)
        self.assertEqual(rejected["error"]["code"], -32602)

    def test_empty_string_cursor_is_followed_and_order_is_stable(self) -> None:
        tools = self.client.discover_tools()
        self.assertEqual(self.client.cursor_trace, [None, ""])
        self.assertEqual(
            sorted(tools),
            ["evidence_bundle", "route_report", "tag_catalog"],
        )
        second_client = main.ContractClient(self.server)
        self.assertEqual(list(tools), list(second_client.discover_tools()))

    def test_explicit_null_cursor_stops_pagination(self) -> None:
        class ExplicitNullCursorServer(main.ContractServer):
            def tools_list(self, params):
                result = super().tools_list(params)
                if params.get("cursor") == "":
                    result["nextCursor"] = None
                return result

        client = main.ContractClient(ExplicitNullCursorServer())
        tools = client.discover_tools()
        self.assertEqual(client.cursor_trace, [None, ""])
        self.assertEqual(
            sorted(tools),
            ["evidence_bundle", "route_report", "tag_catalog"],
        )

    def test_repeated_cursor_is_rejected_before_another_request(self) -> None:
        class RepeatedCursorServer(main.ContractServer):
            def __init__(self):
                super().__init__()
                self.list_calls = 0

            def tools_list(self, params):
                main.validate_request_meta(params)
                self.list_calls += 1
                return main.complete(tools=[], nextCursor="repeat")

        server = RepeatedCursorServer()
        client = main.ContractClient(server)
        with self.assertRaisesRegex(main.ContractViolation, "repeated or cyclic"):
            client.discover_tools()
        self.assertEqual(server.list_calls, 2)
        self.assertEqual(client.cursor_trace, [None, "repeat"])

    def test_cyclic_cursor_chain_is_rejected(self) -> None:
        class CyclicCursorServer(main.ContractServer):
            def tools_list(self, params):
                main.validate_request_meta(params)
                next_cursor = {None: "a", "a": "b", "b": "a"}.get(
                    params.get("cursor")
                )
                return main.complete(tools=[], nextCursor=next_cursor)

        client = main.ContractClient(CyclicCursorServer())
        with self.assertRaisesRegex(main.ContractViolation, "repeated or cyclic"):
            client.discover_tools()
        self.assertEqual(client.cursor_trace, [None, "a", "b"])

    def test_unique_cursor_stream_is_bounded_by_page_limit(self) -> None:
        class EndlessCursorServer(main.ContractServer):
            def __init__(self):
                super().__init__()
                self.list_calls = 0

            def tools_list(self, params):
                main.validate_request_meta(params)
                self.list_calls += 1
                return main.complete(
                    tools=[],
                    nextCursor=f"cursor-{self.list_calls}",
                )

        server = EndlessCursorServer()
        client = main.ContractClient(server, max_list_pages=3)
        with self.assertRaisesRegex(main.ContractViolation, "page limit of 3"):
            client.discover_tools()
        self.assertEqual(server.list_calls, 3)

    def test_sensitive_header_descriptor_is_rejected(self) -> None:
        tools = self.client.discover_tools()
        self.assertNotIn("blocked_secret_route", tools)
        self.assertEqual(self.client.rejections[0]["tool"], "blocked_secret_route")
        self.assertIn("sensitive", self.client.rejections[0]["reason"])

    def test_array_structured_content_is_valid_and_has_text_mirror(self) -> None:
        result = self.client.call("tag_catalog", {})
        self.assertIsInstance(result["structuredContent"], list)
        self.assertEqual(
            json.loads(result["content"][0]["text"]),
            result["structuredContent"],
        )

    def test_client_rejects_nonconforming_structured_output(self) -> None:
        self.client.discover_tools()
        tool = self.client.tools["tag_catalog"]
        bad_result = main.complete(
            content=[{"type": "text", "text": "not an array"}],
            structuredContent={"tags": []},
            isError=False,
        )
        with self.assertRaises(main.ContractViolation):
            main.validate_tool_result(tool, bad_result)

    def test_error_result_cannot_omit_required_structured_output(self) -> None:
        self.client.discover_tools()
        tool = self.client.tools["tag_catalog"]
        bad_result = main.complete(
            content=[{"type": "text", "text": "catalog unavailable"}],
            isError=True,
        )
        with self.assertRaisesRegex(
            main.ContractViolation,
            "outputSchema requires structuredContent",
        ):
            main.validate_tool_result(tool, bad_result)

    def test_error_result_cannot_return_nonconforming_structured_output(self) -> None:
        self.client.discover_tools()
        tool = self.client.tools["tag_catalog"]
        bad_result = main.complete(
            content=[{"type": "text", "text": "catalog unavailable"}],
            structuredContent={"tags": []},
            isError=True,
        )
        with self.assertRaisesRegex(main.ContractViolation, r"\$: expected array"):
            main.validate_tool_result(tool, bad_result)

    def test_all_current_content_block_types_are_validated(self) -> None:
        result = self.client.call("evidence_bundle", {})
        self.assertEqual(
            [block["type"] for block in result["content"]],
            ["text", "image", "audio", "resource_link", "resource"],
        )

    def test_header_audit_records_names_without_values(self) -> None:
        tools = self.client.discover_tools()
        audit_log: list[dict] = []
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": "private-region-42", "report": "quarterly"},
            audit_log,
        )
        self.assertEqual(headers, {"Mcp-Param-Region": "private-region-42"})
        rendered_audit = json.dumps(audit_log)
        self.assertIn("Mcp-Param-Region", rendered_audit)
        self.assertNotIn("private-region-42", rendered_audit)

    def test_visible_ascii_parameter_value_stays_plain(self) -> None:
        tools = self.client.discover_tools()
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": "eu-west", "report": "quarterly"},
            [],
        )
        self.assertEqual(headers["Mcp-Param-Region"], "eu-west")

    def test_unicode_parameter_value_uses_exact_base64_utf8_sentinel(self) -> None:
        tools = self.client.discover_tools()
        value = "münchen"
        payload = base64.b64encode(value.encode("utf-8")).decode("ascii")
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            [],
        )
        encoded = headers["Mcp-Param-Region"]
        self.assertEqual(encoded, f"=?base64?{payload}?=")
        self.assertEqual(main.decode_parameter_header_value(encoded), value)

    def test_newline_parameter_value_is_encoded_instead_of_rejected(self) -> None:
        tools = self.client.discover_tools()
        value = "eu\nwest"
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            [],
        )
        encoded = headers["Mcp-Param-Region"]
        self.assertTrue(encoded.startswith("=?base64?"))
        self.assertEqual(main.decode_parameter_header_value(encoded), value)

    def test_padded_parameter_value_is_encoded_without_trimming(self) -> None:
        tools = self.client.discover_tools()
        value = " eu-west "
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            [],
        )
        encoded = headers["Mcp-Param-Region"]
        self.assertTrue(encoded.startswith("=?base64?"))
        self.assertEqual(main.decode_parameter_header_value(encoded), value)

    def test_sentinel_looking_parameter_value_is_encoded_again(self) -> None:
        tools = self.client.discover_tools()
        value = "=?base64?SGVsbG8=?="
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            [],
        )
        encoded = headers["Mcp-Param-Region"]
        self.assertNotEqual(encoded, value)
        self.assertEqual(main.decode_parameter_header_value(encoded), value)

    def test_safe_integer_boundaries_are_mirrored(self) -> None:
        tool = {
            "name": "shard_route",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "shard": {"type": "integer", "x-mcp-header": "Shard"}
                },
            },
        }
        for value in (main.JS_SAFE_INTEGER_MIN, main.JS_SAFE_INTEGER_MAX):
            with self.subTest(value=value):
                headers = main.build_parameter_headers(tool, {"shard": value}, [])
                self.assertEqual(headers["Mcp-Param-Shard"], str(value))

    def test_unsafe_integer_values_are_rejected(self) -> None:
        tool = {
            "name": "shard_route",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "shard": {"type": "integer", "x-mcp-header": "Shard"}
                },
            },
        }
        for value in (main.JS_SAFE_INTEGER_MIN - 1, main.JS_SAFE_INTEGER_MAX + 1):
            with self.subTest(value=value):
                with self.assertRaises(main.ContractViolation):
                    main.build_parameter_headers(tool, {"shard": value}, [])

    def test_case_insensitive_header_name_and_encoded_value_match_body(self) -> None:
        tools = self.client.discover_tools()
        arguments = {"region": "europe-λ", "report": "quarterly"}
        headers = main.build_parameter_headers(tools["route_report"], arguments, [])
        request = main.make_request(
            50,
            "tools/call",
            {"name": "route_report", "arguments": arguments},
        )
        audit_log: list[dict] = []
        status, response = main.streamable_http_tool_call(
            self.server,
            request,
            {name.swapcase(): value for name, value in headers.items()},
            audit_log,
        )
        self.assertEqual(status, 200)
        self.assertIn("result", response)
        self.assertEqual(audit_log[0]["headerNames"], ["Mcp-Param-Region"])

    def test_missing_recognized_header_is_http_400_and_json_rpc_32020(self) -> None:
        arguments = {"region": "eu-west", "report": "quarterly"}
        request = main.make_request(
            51,
            "tools/call",
            {"name": "route_report", "arguments": arguments},
        )
        status, response = main.streamable_http_tool_call(
            self.server, request, {}, []
        )
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)

    def test_mismatched_recognized_header_is_http_400_and_json_rpc_32020(self) -> None:
        arguments = {"region": "eu-west", "report": "quarterly"}
        request = main.make_request(
            52,
            "tools/call",
            {"name": "route_report", "arguments": arguments},
        )
        status, response = main.streamable_http_tool_call(
            self.server,
            request,
            {"mcp-param-region": "us-west"},
            [],
        )
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)

    def test_duplicated_recognized_header_is_rejected(self) -> None:
        tools = self.client.discover_tools()
        with self.assertRaisesRegex(main.ContractViolation, "duplicated"):
            main.validate_parameter_headers(
                tools["route_report"],
                {"region": "eu-west", "report": "quarterly"},
                {"Mcp-Param-Region": "eu-west", "mcp-param-region": "eu-west"},
                [],
            )

    def test_recognized_header_without_body_argument_is_rejected(self) -> None:
        tools = self.client.discover_tools()
        with self.assertRaisesRegex(main.ContractViolation, "no body argument"):
            main.validate_parameter_headers(
                tools["route_report"],
                {"report": "quarterly"},
                {"Mcp-Param-Region": "eu-west"},
                [],
            )

    def test_encoded_values_remain_redacted_from_client_and_server_audits(self) -> None:
        tools = self.client.discover_tools()
        value = "private-λ\n"
        client_audit: list[dict] = []
        headers = main.build_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            client_audit,
        )
        server_audit: list[dict] = []
        main.validate_parameter_headers(
            tools["route_report"],
            {"region": value, "report": "quarterly"},
            headers,
            server_audit,
        )
        rendered = json.dumps([client_audit, server_audit])
        encoded_payload = headers["Mcp-Param-Region"]
        self.assertNotIn(value, rendered)
        self.assertNotIn(encoded_payload, rendered)

    def test_completion_is_authorized_and_rate_limited(self) -> None:
        self.assertEqual(
            self.client.complete_environment(""),
            ["development", "staging"],
        )
        self.assertNotIn("production", self.client.complete_environment("p"))
        self.client.complete_environment("s")
        with self.assertRaises(main.ContractViolation):
            self.client.complete_environment("")

    def test_protocol_errors_and_tool_errors_stay_separate(self) -> None:
        unknown = self.server.dispatch(
            main.make_request(1, "tools/call", {"name": "missing", "arguments": {}})
        )
        self.assertEqual(unknown["error"]["code"], -32602)

        self.client.discover_tools()
        failed = self.client.call(
            "route_report",
            {"region": "eu-west", "report": "unavailable"},
        )
        self.assertTrue(failed["isError"])
        self.assertEqual(
            failed["structuredContent"],
            {"region": "eu-west", "accepted": False},
        )
        self.assertNotIn("error", failed)

    def test_malformed_x_mcp_header_is_rejected(self) -> None:
        tool = {
            "name": "bad_header",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "region": {
                        "type": "string",
                        "x-mcp-header": "Region\r\nInjected",
                    }
                },
            },
        }
        with self.assertRaises(main.ContractViolation):
            main.validate_tool_descriptor(tool)

    def test_x_mcp_header_inside_one_of_is_rejected(self) -> None:
        tool = {
            "name": "nested_one_of",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "region": {
                        "oneOf": [
                            {"type": "string", "x-mcp-header": "Region"},
                            {"type": "integer"},
                        ]
                    }
                },
            },
        }
        with self.assertRaises(main.ContractViolation):
            main.validate_tool_descriptor(tool)

    def test_x_mcp_header_inside_items_is_rejected(self) -> None:
        tool = {
            "name": "nested_items",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "regions": {
                        "type": "array",
                        "items": {"type": "string", "x-mcp-header": "Region"},
                    }
                },
            },
        }
        with self.assertRaises(main.ContractViolation):
            main.validate_tool_descriptor(tool)

    def test_x_mcp_header_inside_ref_definition_is_rejected(self) -> None:
        tool = {
            "name": "nested_ref",
            "inputSchema": {
                "type": "object",
                "$defs": {
                    "region": {"type": "string", "x-mcp-header": "Region"}
                },
                "properties": {"region": {"$ref": "#/$defs/region"}},
            },
        }
        with self.assertRaises(main.ContractViolation):
            main.validate_tool_descriptor(tool)

    def test_idless_notification_receives_no_json_rpc_response(self) -> None:
        request = main.make_request(1, "tools/list", {})
        del request["id"]
        self.assertIsNone(self.server.dispatch(request))


if __name__ == "__main__":
    unittest.main()
