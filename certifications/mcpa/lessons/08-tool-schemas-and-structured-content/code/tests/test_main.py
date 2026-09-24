import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ToolSchemasAndStructuredContentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.Client(main.build_catalog_server())

    def test_valid_arguments_produce_structured_content_matching_output_schema(self) -> None:
        response = self.client.call("lookup_product", {"sku": "SKU-100"})
        self.assertNotIn("error", response)
        self.assertFalse(response["result"]["isError"])
        tool = main.build_catalog_server().tools["lookup_product"]
        errors = main.validate_arguments(tool.output_schema, response["result"]["structuredContent"])
        self.assertEqual(errors, [])
        self.assertEqual(response["result"]["structuredContent"]["sku"], "SKU-100")

    def test_missing_required_field_is_a_tool_execution_error_not_a_protocol_error(self) -> None:
        response = self.client.call("lookup_product", {"region": "us"})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertIn("sku", response["result"]["content"][0]["text"])

    def test_wrong_typed_field_is_a_tool_execution_error(self) -> None:
        response = self.client.call("lookup_product", {"sku": 100})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("sku", response["result"]["content"][0]["text"])
        self.assertIn("type", response["result"]["content"][0]["text"])

    def test_enum_violation_is_a_tool_execution_error(self) -> None:
        response = self.client.call("lookup_product", {"sku": "SKU-100", "region": "mars"})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("region", response["result"]["content"][0]["text"])

    def test_additional_property_is_rejected_when_schema_forbids_it(self) -> None:
        response = self.client.call("lookup_product", {"sku": "SKU-100", "coupon": "SAVE10"})
        self.assertTrue(response["result"]["isError"])
        self.assertIn("coupon", response["result"]["content"][0]["text"])

    def test_no_parameter_schema_accepts_only_an_empty_object(self) -> None:
        empty = self.client.call("server_time", {})
        self.assertFalse(empty["result"]["isError"])
        extra = self.client.call("server_time", {"tz": "UTC"})
        self.assertTrue(extra["result"]["isError"])
        self.assertIn("tz", extra["result"]["content"][0]["text"])

    def test_unknown_tool_is_a_protocol_error_not_iserror(self) -> None:
        response = self.client.call("delete_catalog", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_network_ref_is_refused_at_registration_never_dereferenced(self) -> None:
        message = main.attempt_network_ref_registration()
        self.assertIn("network", message)
        self.assertIn("https://schemas.example.com", message)

    def test_tool_naming_rules_accept_and_reject_the_right_names(self) -> None:
        self.assertTrue(main.is_valid_tool_name("admin.tools.list"))
        self.assertTrue(main.is_valid_tool_name("DATA_EXPORT_v2"))
        self.assertFalse(main.is_valid_tool_name("look up product"))
        self.assertFalse(main.is_valid_tool_name("x" * 129))
        self.assertFalse(main.is_valid_tool_name(""))

    def test_default_dialect_is_implicit_but_may_be_declared_explicitly(self) -> None:
        server = main.build_catalog_server()
        self.assertNotIn("$schema", server.tools["lookup_product"].input_schema)
        self.assertEqual(server.tools["server_time"].input_schema["$schema"], main.DEFAULT_DIALECT)

    def test_every_result_in_the_transcript_carries_a_known_result_type(self) -> None:
        for message in main.transcript():
            if isinstance(message, dict) and "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})

    def test_tools_list_includes_output_schema_for_lookup_product(self) -> None:
        tools = self.client.list_tools()
        by_name = {tool["name"]: tool for tool in tools}
        self.assertIn("outputSchema", by_name["lookup_product"])
        self.assertNotIn("required", by_name["server_time"]["inputSchema"])


if __name__ == "__main__":
    unittest.main()
