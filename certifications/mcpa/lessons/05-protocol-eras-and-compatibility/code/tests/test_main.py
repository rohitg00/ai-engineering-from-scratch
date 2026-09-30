import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ProtocolErasTests(unittest.TestCase):
    def test_modern_server_detected_by_discover_result(self) -> None:
        client = main.DualEraClient()
        server = main.ModernServer("modern-server", [main.PROTOCOL_VERSION])
        era = client.probe(server)
        self.assertEqual(era, {"era": "modern", "version": main.PROTOCOL_VERSION})
        methods = [entry["method"] for entry in client.log if isinstance(entry, dict) and "method" in entry]
        self.assertEqual(methods, ["server/discover"])

    def test_unsupported_version_triggers_retry_not_fallback(self) -> None:
        client = main.DualEraClient()
        server = main.ModernServer("modern-other-version-server", ["2026-11-18"])
        era = client.probe(server)
        self.assertEqual(era, {"era": "modern", "version": "2026-11-18"})
        methods = [entry["method"] for entry in client.log if isinstance(entry, dict) and "method" in entry]
        self.assertEqual(methods, ["server/discover", "server/discover"])
        self.assertNotIn("initialize", methods)

    def test_unsupported_version_with_no_supported_list_stays_modern_without_retry(self) -> None:
        client = main.DualEraClient()
        server = main.ModernServer("no-versions-server", [])
        era = client.probe(server)
        self.assertEqual(era, {"era": "modern", "version": None})
        methods = [entry["method"] for entry in client.log if isinstance(entry, dict) and "method" in entry]
        self.assertEqual(methods, ["server/discover"])

    def test_unrecognized_error_triggers_legacy_fallback(self) -> None:
        client = main.DualEraClient()
        server = main.LegacyErrorServer("legacy-error-server")
        era = client.probe(server)
        self.assertEqual(era, {"era": "legacy", "version": "2025-11-25"})
        legacy_entries = [entry for entry in client.log if isinstance(entry, dict) and entry.get("legacy")]
        self.assertEqual(len(legacy_entries), 2)
        self.assertEqual(legacy_entries[0]["message"]["method"], "initialize")

    def test_timeout_triggers_legacy_fallback(self) -> None:
        client = main.DualEraClient()
        server = main.LegacyTimeoutServer("legacy-timeout-server")
        era = client.probe(server)
        self.assertEqual(era, {"era": "legacy", "version": "2025-11-25"})
        probes = [entry for entry in client.log if isinstance(entry, dict) and entry.get("method") == "server/discover"]
        self.assertEqual(len(probes), 1)

    def test_era_is_cached_per_server(self) -> None:
        client = main.DualEraClient()
        server = main.ModernServer("modern-server", [main.PROTOCOL_VERSION])
        first = client.probe(server)
        length_after_first = len(client.log)
        second = client.probe(server)
        self.assertEqual(first, second)
        self.assertEqual(len(client.log), length_after_first)

    def test_modern_only_server_names_its_versions_when_rejecting_initialize(self) -> None:
        client = main.DualEraClient()
        server = main.ModernServer("modern-only-server", [main.PROTOCOL_VERSION])
        response = client.demonstrate_rejection(server)
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertEqual(response["error"]["data"]["supportedVersions"], [main.PROTOCOL_VERSION])

    def test_legacy_messages_are_wrapped_in_the_transcript(self) -> None:
        wrapped_requests = [
            entry for entry in main.transcript()
            if isinstance(entry, dict) and isinstance(entry.get("message"), dict) and "method" in entry["message"]
        ]
        self.assertGreater(len(wrapped_requests), 0)
        for entry in wrapped_requests:
            self.assertEqual(entry["message"]["method"], "initialize")
            self.assertTrue(entry.get("legacy"))

    def test_modern_messages_carry_protocol_version_and_capabilities(self) -> None:
        modern_requests = [
            entry for entry in main.transcript()
            if isinstance(entry, dict) and "method" in entry and "jsonrpc" in entry
        ]
        self.assertGreater(len(modern_requests), 0)
        for request in modern_requests:
            meta = request["params"]["_meta"]
            self.assertIn(main.PV_KEY, meta)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_full_transcript_never_reuses_a_request_id(self) -> None:
        request_ids = [
            entry["id"] for entry in main.transcript()
            if isinstance(entry, dict) and "method" in entry and "id" in entry and "jsonrpc" in entry
        ]
        self.assertEqual(len(request_ids), len(set(request_ids)))


if __name__ == "__main__":
    unittest.main()
