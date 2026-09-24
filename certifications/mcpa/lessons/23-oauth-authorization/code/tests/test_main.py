import base64
import hashlib
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ProtectedResourceMetadataDiscoveryTests(unittest.TestCase):
    def test_prm_discovery_prefers_www_authenticate_header(self):
        header = main.www_authenticate_challenge("https://mcp.example.com/.well-known/oauth-protected-resource/mcp")
        urls = main.discover_protected_resource_metadata("https://mcp.example.com/mcp", header)
        self.assertEqual(urls, ["https://mcp.example.com/.well-known/oauth-protected-resource/mcp"])

    def test_prm_discovery_falls_back_to_well_known_order(self):
        urls = main.discover_protected_resource_metadata("https://mcp.example.com/mcp", www_authenticate=None)
        self.assertEqual(
            urls,
            [
                "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
                "https://mcp.example.com/.well-known/oauth-protected-resource",
            ],
        )


class AuthorizationServerDiscoveryTests(unittest.TestCase):
    def test_as_metadata_discovery_order_for_path_issuer(self):
        urls = main.as_metadata_discovery_urls("https://auth.example.com/tenant1")
        self.assertEqual(
            urls,
            [
                "https://auth.example.com/.well-known/oauth-authorization-server/tenant1",
                "https://auth.example.com/.well-known/openid-configuration/tenant1",
                "https://auth.example.com/tenant1/.well-known/openid-configuration",
            ],
        )

    def test_as_metadata_discovery_order_for_root_issuer(self):
        urls = main.as_metadata_discovery_urls("https://auth.example.com")
        self.assertEqual(
            urls,
            [
                "https://auth.example.com/.well-known/oauth-authorization-server",
                "https://auth.example.com/.well-known/openid-configuration",
            ],
        )

    def test_authorization_server_metadata_issuer_must_match(self):
        with self.assertRaises(main.MetadataValidationError):
            main.validate_authorization_server_metadata(
                "https://attacker.example", {"issuer": "https://honest.example"}
            )
        validated = main.validate_authorization_server_metadata(
            "https://auth.example.com", {"issuer": "https://auth.example.com"}
        )
        self.assertEqual(validated["issuer"], "https://auth.example.com")


class PkceTests(unittest.TestCase):
    def test_pkce_code_challenge_s256_matches_manual_computation(self):
        verifier = main.generate_code_verifier()
        challenge = main.code_challenge_s256(verifier)
        expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
        self.assertEqual(challenge, expected)

    def test_pkce_required_refuses_authorization_server_without_support(self):
        with self.assertRaises(main.MetadataValidationError):
            main.require_pkce_s256_support({"issuer": "https://auth.example.com"})
        with self.assertRaises(main.MetadataValidationError):
            main.require_pkce_s256_support({"code_challenge_methods_supported": ["plain"]})
        main.require_pkce_s256_support({"code_challenge_methods_supported": ["S256"]})


class ResourceIndicatorTests(unittest.TestCase):
    def test_authorization_and_token_requests_carry_the_canonical_resource(self):
        as_metadata = {"code_challenge_methods_supported": ["S256"]}
        verifier = main.generate_code_verifier()
        authorization_request = main.build_authorization_request(
            as_metadata,
            client_id="https://client.example.com/client.json",
            redirect_uri="https://client.example.com/callback",
            resource="HTTPS://MCP.Example.com/mcp/",
            code_verifier=verifier,
        )
        self.assertEqual(authorization_request.resource, "https://mcp.example.com/mcp")
        token_request = main.build_token_request(authorization_request, code="abc123", code_verifier=verifier)
        self.assertEqual(token_request.resource, authorization_request.resource)
        self.assertEqual(token_request.code_verifier, verifier)


class IssuerValidationTests(unittest.TestCase):
    def test_issuer_mismatch_rejected(self):
        with self.assertRaises(main.IssuerMismatch):
            main.validate_authorization_response_issuer("https://auth.example.com", "https://attacker.example", True)

    def test_missing_iss_rejected_when_advertised(self):
        with self.assertRaises(main.IssuerMismatch):
            main.validate_authorization_response_issuer("https://auth.example.com", None, True)

    def test_missing_iss_allowed_when_not_advertised(self):
        main.validate_authorization_response_issuer("https://auth.example.com", None, False)

    def test_matching_iss_accepted_when_present_but_not_advertised(self):
        main.validate_authorization_response_issuer("https://auth.example.com", "https://auth.example.com", False)


class ResourceServerTests(unittest.TestCase):
    def setUp(self):
        self.valid = main.AccessToken(value="tok_valid", audience=main.RESOURCE_SERVER_URL, subject="user_1")
        self.foreign = main.AccessToken(value="tok_foreign", audience="https://other.example.com/mcp", subject="user_1")
        self.resource_server = main.ResourceServer(main.RESOURCE_SERVER_URL, [self.valid, self.foreign])

    def test_missing_token_rejected_with_401(self):
        decision = self.resource_server.authorize(None)
        self.assertFalse(decision.ok)
        self.assertEqual(decision.status, 401)

    def test_wrong_audience_token_rejected_with_401(self):
        decision = self.resource_server.authorize(f"Bearer {self.foreign.value}")
        self.assertFalse(decision.ok)
        self.assertEqual(decision.status, 401)

    def test_valid_token_accepted(self):
        decision = self.resource_server.authorize(f"Bearer {self.valid.value}")
        self.assertTrue(decision.ok)
        self.assertEqual(decision.status, 200)
        self.assertEqual(decision.token.subject, "user_1")

    def test_token_never_placed_in_query_string(self):
        url, headers = main.build_request_target(main.RESOURCE_SERVER_URL, "tkn_abcxyz")
        self.assertNotIn("tkn_abcxyz", url)
        self.assertNotIn("?", url)
        self.assertEqual(headers["Authorization"], "Bearer tkn_abcxyz")


class WireTranscriptTests(unittest.TestCase):
    def test_unauthenticated_call_has_no_json_rpc_response_body(self):
        entries = main.transcript()
        first = entries[0]
        self.assertEqual(first["http"]["status"], 401)
        self.assertIn("wwwAuthenticate", first["http"])
        self.assertNotIn("result", first)
        self.assertNotIn("error", first)

    def test_authenticated_retry_completes(self):
        entries = main.transcript()
        second_request, result = entries[1], entries[2]
        self.assertEqual(second_request["http"]["status"], 200)
        self.assertEqual(result["result"]["resultType"], "complete")
        self.assertEqual(result["id"], second_request["message"]["id"])
        self.assertNotEqual(second_request["message"]["id"], entries[0]["message"]["id"])

    def test_every_request_still_carries_protocol_meta(self):
        for entry in main.transcript():
            message = entry.get("message") if isinstance(entry, dict) and "message" in entry else entry
            if isinstance(message, dict) and "method" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)


if __name__ == "__main__":
    unittest.main()
