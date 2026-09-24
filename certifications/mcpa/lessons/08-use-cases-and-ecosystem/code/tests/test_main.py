import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class EcosystemPortabilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_internal_server()
        self.chat_host = main.Host(
            label="assistant-chat",
            client=main.MockClient(server=self.server),
            render=main.render_as_chat_bubble,
        )
        self.sidebar_host = main.Host(
            label="ide-sidebar",
            client=main.MockClient(server=self.server),
            render=main.render_as_sidebar_panel,
        )

    def test_both_hosts_discover_the_same_tool_set_with_schemas(self) -> None:
        chat_tools = self.chat_host.discover()
        sidebar_tools = self.sidebar_host.discover()
        chat_names = [tool["name"] for tool in chat_tools]
        sidebar_names = [tool["name"] for tool in sidebar_tools]
        self.assertEqual(chat_names, sidebar_names)
        self.assertIn("search_knowledge_base", chat_names)
        self.assertIn("inputSchema", chat_tools[0])

    def test_both_hosts_get_identical_result_payload_for_same_call(self) -> None:
        chat_response, _ = self.chat_host.run("search_knowledge_base", {"query": "deploy"})
        sidebar_response, _ = self.sidebar_host.run("search_knowledge_base", {"query": "deploy"})
        self.assertNotIn("error", chat_response)
        self.assertEqual(chat_response["result"], sidebar_response["result"])

    def test_presentation_differs_while_payload_stays_identical(self) -> None:
        chat_response, chat_view = self.chat_host.run("list_open_tickets", {})
        sidebar_response, sidebar_view = self.sidebar_host.run("list_open_tickets", {})
        self.assertEqual(chat_response["result"], sidebar_response["result"])
        self.assertNotEqual(chat_view, sidebar_view)
        self.assertTrue(chat_view.startswith("[chat]"))
        self.assertIn("<panel", sidebar_view)

    def test_server_does_not_know_which_host_is_calling(self) -> None:
        direct_request = {
            "jsonrpc": "2.0",
            "id": 999,
            "method": "tools/call",
            "params": {"name": "search_knowledge_base", "arguments": {"query": "deploy"}},
        }
        direct_response = self.server.handle(direct_request)
        chat_response, _ = self.chat_host.run("search_knowledge_base", {"query": "deploy"})
        self.assertEqual(direct_response["result"], chat_response["result"])

    def test_adding_a_third_host_requires_no_server_changes(self) -> None:
        third_host = main.Host(
            label="cli-agent",
            client=main.MockClient(server=self.server),
            render=lambda name, response: f"$ {name} -> {response}",
        )
        third_names = [tool["name"] for tool in third_host.discover()]
        chat_names = [tool["name"] for tool in self.chat_host.discover()]
        self.assertEqual(third_names, chat_names)
        third_response, _ = third_host.run("search_knowledge_base", {"query": "deploy"})
        chat_response, _ = self.chat_host.run("search_knowledge_base", {"query": "deploy"})
        self.assertEqual(third_response["result"], chat_response["result"])

    def test_unknown_tool_returns_structured_error_for_every_host(self) -> None:
        chat_response, chat_view = self.chat_host.run("delete_everything", {})
        sidebar_response, _ = self.sidebar_host.run("delete_everything", {})
        self.assertEqual(chat_response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertEqual(sidebar_response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertIn("failed", chat_view)

    def test_missing_required_argument_is_rejected_identically_by_both_hosts(self) -> None:
        chat_response, _ = self.chat_host.run("search_knowledge_base", {})
        sidebar_response, _ = self.sidebar_host.run("search_knowledge_base", {})
        self.assertEqual(chat_response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(chat_response["error"]["code"], sidebar_response["error"]["code"])

    def test_response_id_matches_request_id_per_host(self) -> None:
        chat_handshake = self.chat_host.client.initialize()
        sidebar_handshake = self.sidebar_host.client.initialize()
        self.assertEqual(chat_handshake["id"], 1)
        self.assertEqual(sidebar_handshake["id"], 1)


if __name__ == "__main__":
    unittest.main()
