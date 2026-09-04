import unittest

import main


def make_tool(name: str) -> dict:
    return {
        "name": name,
        "description": name,
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    }


class McpClientTests(unittest.TestCase):
    def test_modern_request_contains_current_metadata(self) -> None:
        message = main.modern_request(1, "tools/list", {}, main.PROTOCOL_VERSION, {"extensions": {}})
        meta = message["params"]["_meta"]
        self.assertEqual(meta[main.VERSION_KEY], main.PROTOCOL_VERSION)
        self.assertEqual(meta[main.CAPABILITIES_KEY], {"extensions": {}})
        self.assertEqual(meta[main.CLIENT_INFO_KEY], main.CLIENT_INFO)

    def test_modern_discovery_never_initializes(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("modern", server)
        client.connect_all()
        self.assertEqual(client.peers["modern"].era, "modern")
        self.assertEqual([message["method"] for message in server.received], ["server/discover"])

    def test_unsupported_version_retries_modern(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])
        client = main.MultiServerClient(
            supported_modern=("2027-01-01", main.PROTOCOL_VERSION),
            probe_version="2027-01-01",
        )
        client.add_server("modern", server)
        client.connect_all()
        methods = [message["method"] for message in server.received]
        versions = [message["params"]["_meta"][main.VERSION_KEY] for message in server.received]
        self.assertEqual(methods, ["server/discover", "server/discover"])
        self.assertEqual(versions, ["2027-01-01", main.PROTOCOL_VERSION])
        self.assertNotIn("initialize", methods)

    def test_recognized_modern_errors_never_fall_back(self) -> None:
        cases = (
            (-32020, "Header mismatch", None),
            (-32021, "Missing capability", None),
            (-32022, "Unsupported version", {"supported": ["2099-01-01"]}),
        )
        for code, message, data in cases:
            with self.subTest(code=code):
                received = []

                def modern_error(
                    request: dict,
                    timeout_ms: int | None = None,
                    *,
                    sink: list[dict] = received,
                    error_code: int = code,
                    error_message: str = message,
                    error_data: dict | None = data,
                ) -> dict:
                    sink.append(request)
                    return main.rpc_error(
                        request.get("id"),
                        error_code,
                        error_message,
                        error_data,
                    )

                client = main.MultiServerClient()
                client.add_server("broken-modern", modern_error, allow_legacy=True)
                with self.assertRaises(RuntimeError):
                    client.connect_all()
                self.assertEqual(
                    [request["method"] for request in received],
                    ["server/discover"],
                )

    def test_timeout_without_allowlist_fails_without_initialize(self) -> None:
        received = []

        def timed_out(message: dict, timeout_ms: int | None = None) -> dict:
            received.append(message)
            raise TimeoutError("deadline exceeded")

        client = main.MultiServerClient()
        client.add_server("unknown", timed_out)
        with self.assertRaisesRegex(RuntimeError, "not allowlisted"):
            client.connect_all()
        self.assertEqual([message["method"] for message in received], ["server/discover"])

    def test_unrecognized_error_without_allowlist_fails_without_initialize(self) -> None:
        received = []

        def unknown_error(message: dict, timeout_ms: int | None = None) -> dict:
            received.append(message)
            return main.rpc_error(message.get("id"), -32601, "Method not found")

        client = main.MultiServerClient()
        client.add_server("unknown", unknown_error)
        with self.assertRaisesRegex(RuntimeError, "not allowlisted"):
            client.connect_all()
        self.assertEqual([message["method"] for message in received], ["server/discover"])

    def test_empty_response_and_connection_close_do_not_prove_legacy(self) -> None:
        for signal in ("empty", "closed"):
            with self.subTest(signal=signal):
                received = []

                def unavailable(
                    message: dict,
                    timeout_ms: int | None = None,
                    *,
                    sink: list[dict] = received,
                    current_signal: str = signal,
                ) -> dict | None:
                    sink.append(message)
                    if current_signal == "closed":
                        raise ConnectionError("transport closed")
                    return None

                client = main.MultiServerClient()
                client.add_server("unknown", unavailable)
                with self.assertRaisesRegex(RuntimeError, "not allowlisted"):
                    client.connect_all()
                self.assertEqual(
                    [message["method"] for message in received],
                    ["server/discover"],
                )

    def test_allowlisted_legacy_with_valid_initialize_succeeds(self) -> None:
        server = main.LegacyFakeServer("legacy", [make_tool("search")])
        client = main.MultiServerClient(legacy_probe_timeout_ms=275)
        client.add_server("legacy", server, allow_legacy=True)
        client.connect_all()
        methods = [message["method"] for message in server.received]
        self.assertEqual(client.peers["legacy"].era, "legacy")
        self.assertEqual(methods, ["server/discover", "initialize", "notifications/initialized"])
        self.assertEqual(server.timeouts_ms, [1_000, 275, None])

    def test_allowlisted_malformed_legacy_response_fails_closed(self) -> None:
        received = []

        def malformed_legacy(message: dict, timeout_ms: int | None = None) -> dict:
            received.append(message)
            if message["method"] == "server/discover":
                return main.rpc_error(message["id"], -32601, "Method not found")
            return {
                "jsonrpc": "2.0",
                "id": message["id"],
                "result": {
                    "protocolVersion": main.LEGACY_VERSION,
                    "capabilities": {},
                },
            }

        client = main.MultiServerClient()
        client.add_server("fake-legacy", malformed_legacy, allow_legacy=True)
        with self.assertRaisesRegex(RuntimeError, "malformed legacy initialize result"):
            client.connect_all()
        peer = client.peers["fake-legacy"]
        self.assertEqual(peer.era, "unknown")
        self.assertFalse(peer.available)
        self.assertEqual(
            [message["method"] for message in received],
            ["server/discover", "initialize"],
        )

    def test_allowlisted_unsupported_legacy_revision_fails_closed(self) -> None:
        received = []

        def unsupported_legacy(message: dict, timeout_ms: int | None = None) -> dict:
            received.append(message)
            if message["method"] == "server/discover":
                return main.rpc_error(message["id"], -32601, "Method not found")
            return {
                "jsonrpc": "2.0",
                "id": message["id"],
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "legacy", "version": "0.9.0"},
                },
            }

        client = main.MultiServerClient()
        client.add_server("old-legacy", unsupported_legacy, allow_legacy=True)
        with self.assertRaisesRegex(RuntimeError, "unsupported legacy protocol revision"):
            client.connect_all()
        self.assertEqual(client.peers["old-legacy"].era, "unknown")
        self.assertNotIn(
            "notifications/initialized",
            [message["method"] for message in received],
        )

    def test_selected_peer_era_is_cached_for_transport_lifetime(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("modern", server)
        client.connect_all()
        client.connect_all()
        self.assertEqual(
            [message["method"] for message in server.received],
            ["server/discover"],
        )

    def test_request_rejects_a_response_without_result_or_error(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("modern", server)
        client.connect_all()

        def malformed_response(
            message: dict,
            timeout_ms: int | None = None,
        ) -> dict:
            return {"jsonrpc": "2.0", "id": message["id"]}

        client.peers["modern"].transport = malformed_response
        with self.assertRaisesRegex(RuntimeError, "exactly one of result or error"):
            client.discover_tools()

    def test_discovery_rejects_a_boolean_response_id_for_an_integer_request(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])

        def boolean_id_response(
            message: dict,
            timeout_ms: int | None = None,
        ) -> dict | None:
            response = server(message, timeout_ms)
            if response is not None:
                response["id"] = True
            return response

        client = main.MultiServerClient()
        client.add_server("modern", boolean_id_response)
        with self.assertRaisesRegex(RuntimeError, "invalid JSON-RPC response envelope"):
            client.connect_all()

    def test_merge_is_deterministic_and_prefixes_collisions(self) -> None:
        alpha = main.ModernFakeServer("alpha", [make_tool("search"), make_tool("write")])
        beta = main.ModernFakeServer("beta", [make_tool("read"), make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("beta", beta)
        client.add_server("alpha", alpha)
        client.connect_all()
        client.discover_tools()
        client.merge()
        self.assertEqual(list(client.registry), ["beta/search", "read", "search", "write"])
        self.assertEqual(client.registry["search"].peer_name, "alpha")

    def test_modern_tool_call_repeats_metadata(self) -> None:
        server = main.ModernFakeServer("modern", [make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("modern", server)
        client.connect_all()
        client.discover_tools()
        client.merge()
        result = client.call("search", {})
        call = server.received[-1]
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(call["method"], "tools/call")
        self.assertEqual(call["params"]["_meta"][main.VERSION_KEY], main.PROTOCOL_VERSION)

    def test_legacy_result_is_normalized_internally(self) -> None:
        server = main.LegacyFakeServer("legacy", [make_tool("search")])
        client = main.MultiServerClient()
        client.add_server("legacy", server, allow_legacy=True)
        client.connect_all()
        client.discover_tools()
        client.merge()
        result = client.call("search", {})
        self.assertEqual(result["resultType"], "complete")


if __name__ == "__main__":
    unittest.main()
