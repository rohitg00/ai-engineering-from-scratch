import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class HostsClientsAndServersTests(unittest.TestCase):
    def setUp(self) -> None:
        self.host, self.files, self.notes, self.metrics = main.build_host()

    def test_each_client_is_bound_to_exactly_one_server(self) -> None:
        self.assertIs(self.files.server, self.host.connections["files"].server)
        self.assertIsNot(self.files.server, self.notes.server)
        self.assertIsNot(self.notes.server, self.metrics.server)

    def test_discover_runs_independently_per_server(self) -> None:
        self.assertIn("tools", self.files.capabilities)
        self.assertIn("tools", self.notes.capabilities)
        self.assertNotIn("tools", self.metrics.capabilities)
        self.assertIn("resources", self.metrics.capabilities)
        self.assertEqual(self.files.log[0]["method"], "server/discover")
        self.assertEqual(self.notes.log[0]["method"], "server/discover")
        self.assertEqual(self.metrics.log[0]["method"], "server/discover")

    def test_colliding_tool_name_is_disambiguated_by_server_prefix(self) -> None:
        self.assertIn("search", self.host.registry)
        self.assertIn("notes/search", self.host.registry)
        self.assertEqual(self.host.registry["search"], ("files", "search"))
        self.assertEqual(self.host.registry["notes/search"], ("notes", "search"))

    def test_routing_reaches_the_correct_server(self) -> None:
        canonical = self.host.route("search", {"query": "budget"})
        prefixed = self.host.route("notes/search", {"query": "budget"})
        self.assertIn("files:", canonical["result"]["content"][0]["text"])
        self.assertIn("notes:", prefixed["result"]["content"][0]["text"])

    def test_capabilities_are_checked_before_listing_a_servers_tools(self) -> None:
        self.assertNotIn("tools", self.metrics.capabilities)
        self.assertFalse(any(server_id == "metrics" for server_id, _ in self.host.registry.values()))
        methods_called = [message["method"] for message in self.metrics.log if "method" in message]
        self.assertEqual(methods_called, ["server/discover"])

    def test_servers_with_identical_serverinfo_name_route_independently(self) -> None:
        self.assertEqual(self.files.server_info["name"], self.notes.server_info["name"])
        files_result = self.host.route("read_file", {"path": "a.txt"})
        notes_result = self.host.route("save_note", {"title": "x"})
        self.assertIn("files:", files_result["result"]["content"][0]["text"])
        self.assertIn("notes:", notes_result["result"]["content"][0]["text"])

    def test_unknown_tool_on_a_specific_server_is_a_protocol_error(self) -> None:
        response = self.notes.call("delete_note", {})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_missing_argument_routed_through_the_host_is_a_tool_execution_error(self) -> None:
        response = self.host.route("save_note", {})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])

    def test_registry_rebuilds_deterministically(self) -> None:
        first = dict(self.host.registry)
        second = self.host.build_registry()
        self.assertEqual(first, second)

    def test_every_request_on_the_wire_carries_version_and_capabilities(self) -> None:
        for message in main.transcript():
            if "method" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
