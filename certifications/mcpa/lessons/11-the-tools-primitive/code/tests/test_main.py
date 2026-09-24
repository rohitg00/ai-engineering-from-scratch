import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ToolsPrimitiveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_tool_server()
        self.client = main.Client(self.server)

    def test_text_and_structured_content_blocks_are_well_formed(self) -> None:
        response = self.client.call("summarize_ticket", {"ticket_id": "TCK-9"})
        result = response["result"]
        self.assertEqual(result["content"][0]["type"], "text")
        self.assertIsInstance(result["content"][0]["text"], str)
        self.assertEqual(result["structuredContent"]["id"], "TCK-9")

    def test_image_and_audio_content_blocks_are_well_formed(self) -> None:
        badge = self.client.call("render_badge", {"status": "green"})["result"]["content"][0]
        self.assertEqual(badge["type"], "image")
        self.assertIn("data", badge)
        self.assertEqual(badge["mimeType"], "image/png")
        greeting = self.client.call("speak_greeting", {"name": "Priya"})["result"]["content"][0]
        self.assertEqual(greeting["type"], "audio")
        self.assertIn("data", greeting)
        self.assertEqual(greeting["mimeType"], "audio/wav")

    def test_resource_link_has_uri_and_name(self) -> None:
        block = self.client.call("get_readme_link", {})["result"]["content"][0]
        self.assertEqual(block["type"], "resource_link")
        self.assertTrue(block["uri"])
        self.assertTrue(block["name"])

    def test_embedded_resource_annotations_sit_beside_resource_not_inside_it(self) -> None:
        block = self.client.call("embed_config", {})["result"]["content"][0]
        self.assertEqual(block["type"], "resource")
        self.assertIn("annotations", block)
        self.assertNotIn("annotations", block["resource"])
        self.assertEqual(block["resource"]["uri"], "config://release-desk/thresholds")

    def test_audience_filter_excludes_blocks_meant_for_someone_else(self) -> None:
        badge_blocks = self.client.call("render_badge", {"status": "red"})["result"]["content"]
        self.assertEqual(len(main.render_for_audience(badge_blocks, "user")), 1)
        self.assertEqual(len(main.render_for_audience(badge_blocks, "assistant")), 0)
        plain_blocks = self.client.call("describe_release", {})["result"]["content"]
        self.assertEqual(len(main.render_for_audience(plain_blocks, "assistant")), 1)

    def test_is_error_is_absent_on_a_normal_success(self) -> None:
        result = self.client.call("describe_release", {})["result"]
        self.assertNotIn("isError", result)
        self.assertFalse(result.get("isError", False))

    def test_unknown_tool_is_invalid_params_not_a_tool_result(self) -> None:
        response = self.client.call("archive_release", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_tools_list_paginates_and_carries_cache_hints(self) -> None:
        first = self.client.list_tools_page()["result"]
        self.assertEqual(len(first["tools"]), 2)
        self.assertEqual(first["nextCursor"], "2")
        self.assertGreaterEqual(first["ttlMs"], 0)
        self.assertEqual(first["cacheScope"], "public")
        second = self.client.list_tools_page("2")["result"]
        self.assertEqual(second["nextCursor"], "")
        third = self.client.list_tools_page("")["result"]
        self.assertNotIn("nextCursor", third)
        names = [tool["name"] for tool in first["tools"] + second["tools"] + third["tools"]]
        self.assertEqual(names, sorted(names))
        self.assertEqual(len(names), 6)

    def test_empty_string_cursor_is_a_real_page_not_the_end(self) -> None:
        definitions = self.client.list_all_tool_definitions()
        self.assertEqual(len(definitions), 6)
        self.assertEqual([tool["name"] for tool in definitions], sorted(tool["name"] for tool in definitions))

    def test_invalid_cursor_is_rejected(self) -> None:
        response = self.client.list_tools_page("not-a-real-cursor")
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_request_without_meta_is_rejected(self) -> None:
        response = self.server.handle({"jsonrpc": "2.0", "id": 99, "method": "tools/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_tool_list_is_identical_across_independent_connections(self) -> None:
        other_client = main.Client(main.build_tool_server())
        self.assertEqual(self.client.list_all_tool_definitions(), other_client.list_all_tool_definitions())

    def test_effective_tool_annotations_apply_documented_defaults(self) -> None:
        greeting = self.server.tools["speak_greeting"].definition()
        self.assertEqual(main.effective_tool_annotations(greeting), main.ANNOTATION_DEFAULTS)
        badge = self.server.tools["render_badge"].definition()
        effective = main.effective_tool_annotations(badge)
        self.assertTrue(effective["readOnlyHint"])
        self.assertFalse(effective["idempotentHint"])

    def test_subscription_stream_acknowledges_before_reporting_a_change(self) -> None:
        client = main.Client(main.build_tool_server())
        before = len(client.list_all_tool_definitions())
        listen_request = client.open_listen({"toolsListChanged": True})
        ack = client.log[-1]
        self.assertEqual(ack["method"], "notifications/subscriptions/acknowledged")
        self.assertEqual(ack["params"]["_meta"][main.SUBSCRIPTION_ID_KEY], listen_request["id"])
        client.server.add_tool(main.build_triage_incident_tool())
        client.server.queue_tools_list_changed(listen_request["id"])
        changed = client.expect_list_changed()
        self.assertEqual(changed["params"]["_meta"][main.SUBSCRIPTION_ID_KEY], listen_request["id"])
        after = len(client.list_all_tool_definitions())
        self.assertEqual(after, before + 1)
        closed = client.close_listen(listen_request)
        self.assertEqual(closed["result"]["resultType"], "complete")
        self.assertEqual(closed["result"]["_meta"][main.SUBSCRIPTION_ID_KEY], listen_request["id"])

    def test_every_result_in_the_transcript_carries_a_result_type(self) -> None:
        for message in main.transcript():
            if "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
