import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class RegistryGatewayTierTests(unittest.TestCase):
    def test_namespace_owned_by_verifier_is_accepted(self) -> None:
        verified = {"io.github.acme": "acme-org"}
        entry = main.ServerEntry(schema_url=main.REGISTRY_SCHEMA_URL, name="io.github.acme/weather-mcp", version="1.0.0", visibility="public")
        result = main.admit_to_registry(entry, "acme-org", verified)
        self.assertTrue(result.accepted)

    def test_spoofed_namespace_is_rejected(self) -> None:
        verified = {"io.github.acme": "acme-org"}
        entry = main.ServerEntry(schema_url=main.REGISTRY_SCHEMA_URL, name="io.github.acme/weather-mcp", version="1.0.0", visibility="public")
        result = main.admit_to_registry(entry, "mallory", verified)
        self.assertFalse(result.accepted)
        self.assertIn("not verified", result.reason)

    def test_private_server_rejected_from_public_registry(self) -> None:
        verified = {"com.example": "example-domain-owner"}
        entry = main.ServerEntry(schema_url=main.REGISTRY_SCHEMA_URL, name="com.example/internal-tool", version="1.0.0", visibility="private")
        result = main.admit_to_registry(entry, "example-domain-owner", verified)
        self.assertFalse(result.accepted)
        self.assertIn("publicly accessible", result.reason)

    def test_version_range_string_is_prohibited(self) -> None:
        for bad in ("^1.2.3", "~1.2.3", ">=1.2.3", "<=1.2.3", "1.x", "1.2.*", "1.2 || 1.3", "1 - 2"):
            self.assertTrue(main.looks_like_version_range(bad), bad)
        for good in ("1.0.0", "2.1.3-alpha", "1.0.0-beta.1", "2025-06-18", "v1.0"):
            self.assertFalse(main.looks_like_version_range(good), good)
        verified = {"com.example": "owner"}
        ranged_entry = main.ServerEntry(schema_url=main.REGISTRY_SCHEMA_URL, name="com.example/tool", version="^1.2.3", visibility="public")
        self.assertFalse(main.admit_to_registry(ranged_entry, "owner", verified).accepted)

    def test_server_json_schema_version_is_independent_of_protocol_version(self) -> None:
        schema_version = main.schema_version_from_url(main.REGISTRY_SCHEMA_URL)
        self.assertEqual(schema_version, "2025-12-11")
        self.assertNotEqual(schema_version, main.PROTOCOL_VERSION)

    def test_resolve_install_target_prefers_remote_then_falls_back_to_package(self) -> None:
        both = main.ServerEntry(
            schema_url=main.REGISTRY_SCHEMA_URL,
            name="com.example/multi",
            version="1.0.0",
            visibility="public",
            packages=[main.ServerPackage("npm", "@x/y", "1.0.0", "stdio")],
            remotes=[main.ServerRemote("streamable-http", "https://x.example.com/mcp")],
        )
        self.assertEqual(
            main.resolve_install_target(both, prefer="remote"),
            {"kind": "remote", "type": "streamable-http", "location": "https://x.example.com/mcp"},
        )
        package_only = main.ServerEntry(
            schema_url=main.REGISTRY_SCHEMA_URL,
            name="com.example/pkg-only",
            version="1.0.0",
            visibility="public",
            packages=[main.ServerPackage("pypi", "pkg-only", "1.0.0", "stdio")],
        )
        self.assertEqual(
            main.resolve_install_target(package_only, prefer="remote"),
            {"kind": "package", "registryType": "pypi", "location": "pkg-only", "transport": "stdio"},
        )

    def test_tier_requirement_lookup_is_correct(self) -> None:
        self.assertEqual(main.tier_requirement(1, "conformancePct"), 100)
        self.assertEqual(main.tier_requirement(2, "conformancePct"), 80)
        self.assertEqual(main.tier_requirement(3, "conformancePct"), 0)
        self.assertEqual(main.tier_requirement(1, "criticalBugDays"), 7)
        self.assertEqual(main.tier_requirement(2, "criticalBugDays"), 14)
        self.assertTrue(main.tier_requirement(1, "stableRelease"))
        self.assertFalse(main.tier_requirement(3, "stableRelease"))

    def test_relegation_rule_drops_tier_on_sustained_conformance_failure(self) -> None:
        self.assertEqual(main.relegate(1, 99, 4), 2)
        self.assertEqual(main.relegate(1, 99, 3), 1)
        self.assertEqual(main.relegate(2, 75, 4), 3)
        self.assertEqual(main.relegate(2, 85, 4), 2)

    def test_gateway_routes_tools_call_by_mcp_name_header(self) -> None:
        gateway, accounts, status = main.build_gateway()
        response = gateway.call_tool("token-x", "lookup_account", {"accountId": "acct-9"})
        self.assertNotIn("error", response)
        self.assertIn("acct-9", response["result"]["content"][0]["text"])
        self.assertEqual(accounts.call_count["lookup_account"], 1)
        self.assertEqual(status.call_count, {})

    def test_gateway_header_mismatch_is_rejected_with_header_mismatch_code(self) -> None:
        gateway, accounts, status = main.build_gateway()
        error = gateway.call_tool_with_mismatched_method_header(
            "token-x", "lookup_account", {"accountId": "acct-1"}, "Mcp-Method disagrees with the JSON-RPC method"
        )
        self.assertEqual(error["error"]["code"], main.HEADER_MISMATCH)
        self.assertIn("Mcp-Method", error["error"]["data"]["headers"])
        self.assertEqual(accounts.call_count.get("lookup_account", 0), 0)

    def test_private_resource_cache_is_partitioned_by_token(self) -> None:
        gateway, accounts, status = main.build_gateway()
        gateway.read_resource("token-alice", "billing://acct/statement")
        gateway.read_resource("token-alice", "billing://acct/statement")
        gateway.read_resource("token-bob", "billing://acct/statement")
        self.assertEqual(accounts.read_count["billing://acct/statement"], 2)

    def test_public_resource_cache_is_shared_across_tokens(self) -> None:
        gateway, accounts, status = main.build_gateway()
        gateway.read_resource("token-alice", "status://service")
        gateway.read_resource("token-bob", "status://service")
        self.assertEqual(status.read_count["status://service"], 1)

    def test_gateway_never_forwards_the_caller_token_into_the_backend_message(self) -> None:
        gateway, accounts, status = main.build_gateway()
        gateway.call_tool("secret-token-value", "lookup_account", {"accountId": "acct-1"})
        for entry in gateway.log:
            message = entry.get("message") if isinstance(entry, dict) else entry
            self.assertNotIn("secret-token-value", json.dumps(message))

    def test_gateway_log_records_a_principal_reference_never_the_raw_token(self) -> None:
        gateway, accounts, status = main.build_gateway()
        gateway.call_tool("secret-token-value", "lookup_account", {"accountId": "acct-1"})
        gateway.read_resource("secret-token-value", "billing://acct/statement")
        self.assertNotIn("secret-token-value", json.dumps(gateway.log))
        principals = {entry["principal"] for entry in gateway.log if isinstance(entry, dict) and "principal" in entry}
        self.assertEqual(principals, {main.principal_ref("secret-token-value")})

    def test_backend_answers_an_unimplemented_method_with_method_not_found(self) -> None:
        gateway, accounts, status = main.build_gateway()
        response = accounts.handle(main.make_request(1, "prompts/list"))
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)

    def test_every_request_in_transcript_carries_protocol_version_and_capabilities(self) -> None:
        for entry in main.transcript():
            message = entry.get("message") if isinstance(entry, dict) and "message" in entry else entry
            if isinstance(message, dict) and "method" in message and "id" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
