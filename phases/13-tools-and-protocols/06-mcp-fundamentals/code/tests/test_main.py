import unittest

import main


class McpFundamentalsTests(unittest.TestCase):
    def test_request_repeats_required_metadata(self) -> None:
        message = main.make_request(1, "tools/list", capabilities={"extensions": {}})
        meta = message["params"]["_meta"]
        self.assertEqual(meta[main.VERSION_KEY], main.PROTOCOL_VERSION)
        self.assertEqual(meta[main.CAPABILITIES_KEY], {"extensions": {}})
        self.assertEqual(meta[main.CLIENT_INFO_KEY], main.CLIENT_INFO)

    def test_discover_is_complete_and_identifies_server(self) -> None:
        response = main.dispatch(main.make_request(1, "server/discover"))
        result = response["result"]
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(result["_meta"][main.SERVER_INFO_KEY], main.SERVER_INFO)

    def test_list_is_cacheable_and_deterministic(self) -> None:
        response = main.dispatch(main.make_request(2, "tools/list"))
        result = response["result"]
        names = [tool["name"] for tool in result["tools"]]
        self.assertEqual(names, sorted(names))
        self.assertEqual(result["ttlMs"], 30_000)
        self.assertEqual(result["cacheScope"], "public")

    def test_missing_capabilities_are_not_inferred(self) -> None:
        message = main.make_request(3, "tools/list")
        del message["params"]["_meta"][main.CAPABILITIES_KEY]
        response = main.dispatch(message)
        self.assertEqual(response["error"]["code"], -32602)

    def test_unsupported_version_advertises_supported_versions(self) -> None:
        response = main.dispatch(main.make_request(4, "tools/list", version="2027-01-01"))
        error = response["error"]
        self.assertEqual(error["code"], -32022)
        self.assertEqual(error["data"]["requested"], "2027-01-01")
        self.assertEqual(error["data"]["supported"], [main.PROTOCOL_VERSION])

    def test_client_info_is_recommended_not_required(self) -> None:
        message = main.make_request(5, "tools/list")
        del message["params"]["_meta"][main.CLIENT_INFO_KEY]
        response = main.dispatch(message)
        self.assertEqual(response["result"]["resultType"], "complete")

    def test_tracer_distinguishes_modern_and_legacy(self) -> None:
        modern = main.trace_message(main.make_request(6, "tools/list"))
        legacy = main.trace_message({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        self.assertEqual(modern.era, "modern")
        self.assertEqual(legacy.era, "legacy")


if __name__ == "__main__":
    unittest.main()
