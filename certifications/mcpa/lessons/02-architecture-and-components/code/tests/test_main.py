import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ArchitectureAndComponentsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.host = main.Host()
        self.files_client = main.MockClient(server=main.build_files_server())
        self.search_client = main.MockClient(server=main.build_search_server())

    def test_two_independent_connections_are_established(self) -> None:
        self.host.connect(self.files_client)
        self.host.connect(self.search_client)
        self.assertEqual(set(self.host.clients), {"files", "search"})
        self.assertIsNot(self.host.clients["files"], self.host.clients["search"])

    def test_each_client_is_bound_to_exactly_one_server(self) -> None:
        self.host.connect(self.files_client)
        self.host.connect(self.search_client)
        self.assertIs(self.host.clients["files"].server, self.files_client.server)
        self.assertIs(self.host.clients["search"].server, self.search_client.server)
        self.assertIsNot(self.host.clients["files"].server, self.host.clients["search"].server)

    def test_handshake_echoes_protocol_version_and_declared_capabilities(self) -> None:
        files_handshake = self.host.connect(self.files_client)
        search_handshake = self.host.connect(self.search_client)
        self.assertEqual(files_handshake["result"]["protocolVersion"], main.PROTOCOL_VERSION)
        self.assertEqual(search_handshake["result"]["protocolVersion"], main.PROTOCOL_VERSION)
        self.assertEqual(files_handshake["result"]["capabilities"], {"tools": {"listChanged": False}})
        self.assertEqual(
            search_handshake["result"]["capabilities"],
            {"tools": {"listChanged": True}, "resources": {}},
        )

    def test_version_mismatch_is_reported_as_error_not_crash(self) -> None:
        legacy_client = main.MockClient(server=main.build_mismatched_server())
        response = self.host.connect(legacy_client)
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.VERSION_MISMATCH)
        self.assertNotIn("legacy", self.host.clients)

    def test_host_routes_tool_call_to_the_correct_server(self) -> None:
        self.host.connect(self.files_client)
        self.host.connect(self.search_client)
        read = self.host.route_tool_call("read_file", {"path": "notes.txt"})
        search = self.host.route_tool_call("web_search", {"query": "topology"})
        self.assertIn("notes.txt", read["result"]["content"][0]["text"])
        self.assertTrue(read["result"]["content"][0]["text"].startswith("files:"))
        self.assertTrue(search["result"]["content"][0]["text"].startswith("search:"))

    def test_routing_an_unconnected_tool_returns_structured_error(self) -> None:
        self.host.connect(self.files_client)
        response = self.host.route_tool_call("delete_everything", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_each_connection_keeps_an_independent_request_id_sequence(self) -> None:
        self.host.connect(self.files_client)
        self.host.connect(self.search_client)
        self.files_client.list_tools()
        self.assertEqual(self.files_client._next_id, 3)
        self.assertEqual(self.search_client._next_id, 2)

    def test_tool_directory_maps_every_discovered_tool_to_its_owning_server(self) -> None:
        self.host.connect(self.files_client)
        self.host.connect(self.search_client)
        directory = self.host.tool_directory()
        self.assertEqual(directory, {"read_file": "files", "web_search": "search"})


if __name__ == "__main__":
    unittest.main()
