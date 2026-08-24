"""Tests for current MCP authorization and stateless requests."""

from __future__ import annotations

import importlib.util
import pathlib
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch


MODULE_PATH = pathlib.Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson16_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


def cimd_document(url: str) -> dict:
    return {
        "client_id": url,
        "client_name": "Portable client",
        "redirect_uris": ["https://client.example.com/callback"],
    }


class OAuthLessonTests(unittest.TestCase):
    def authorization_code(self):
        auth = main.AuthorizationServer()
        client = main.Client()
        client_id = client.enroll(auth)
        verifier, challenge = main.pkce_pair()
        response = auth.authorize(
            client_id=client_id,
            redirect_uri=client.redirect_uri,
            subject=client.subject,
            scopes={"notes:read"},
            challenge=challenge,
            resource=main.RESOURCE,
        )
        return auth, client, client_id, verifier, response["code"]

    def test_discover_uses_current_result_shape(self):
        server = main.ResourceServer()
        body, headers = main.make_discover_request(7)
        status, response, _ = server.discover(body, headers)
        self.assertEqual(status, 200)
        self.assertEqual(response["id"], 7)
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(response["result"]["_meta"][main.SERVER_INFO_META], main.SERVER_INFO)

    def test_tools_list_is_advertised_complete_and_deterministic(self):
        server = main.ResourceServer()
        body, headers = main.make_tools_list_request(8)
        status, first, _ = server.handle(body, headers)
        body, headers = main.make_tools_list_request(9)
        _, second, _ = server.handle(body, headers)
        self.assertEqual(status, 200)
        discover_body, discover_headers = main.make_discover_request()
        _, discovery, _ = server.discover(discover_body, discover_headers)
        self.assertIn("tools", discovery["result"]["capabilities"])
        tools = first["result"]["tools"]
        self.assertEqual(tools, second["result"]["tools"])
        self.assertEqual([tool["name"] for tool in tools], sorted(tool["name"] for tool in tools))
        self.assertTrue(all(tool["inputSchema"]["type"] == "object" for tool in tools))
        self.assertEqual(first["result"]["resultType"], "complete")
        self.assertGreater(first["result"]["ttlMs"], 0)
        self.assertEqual(first["result"]["cacheScope"], "public")
        self.assertEqual(first["result"]["_meta"][main.SERVER_INFO_META], main.SERVER_INFO)

    def test_protected_resource_metadata_selects_issuer_and_path(self):
        metadata = main.ResourceServer().protected_resource_metadata()
        self.assertEqual(metadata["resource"], main.RESOURCE)
        self.assertEqual(metadata["authorization_servers"], [main.ISSUER])
        self.assertEqual(
            main.RESOURCE_METADATA_URI,
            "https://notes.example.com/.well-known/oauth-protected-resource/mcp",
        )

    def test_cimd_client_id_is_metadata_url(self):
        auth = main.AuthorizationServer()
        client = main.Client()
        client_id = client.enroll(auth)
        self.assertEqual(client_id, main.CLIENT_METADATA_URL)
        self.assertEqual(auth.clients[client_id]["enrollment"], "cimd")

    def test_cimd_requires_path_but_not_application_type(self):
        auth = main.AuthorizationServer()
        document = cimd_document("https://client.example.com/client.json")
        self.assertEqual(auth.enroll_cimd(document["client_id"], document), document["client_id"])
        with self.assertRaisesRegex(ValueError, "with a path"):
            auth.enroll_cimd(
                "https://client.example.com",
                {**document, "client_id": "https://client.example.com"},
            )

    def test_cimd_rejects_forbidden_identifier_url_components(self):
        auth = main.AuthorizationServer()
        cases = [
            ("https://user:password@client.example.com/client.json", "userinfo"),
            ("https://client.example.com/client.json#fragment", "fragment"),
            ("https://client.example.com/oauth/./client.json", "dot path"),
            ("https://client.example.com/oauth/../client.json", "dot path"),
        ]
        for url, error in cases:
            with self.subTest(url=url):
                with self.assertRaisesRegex(ValueError, error):
                    auth.enroll_cimd(url, cimd_document(url))

    def test_cimd_rejects_secret_bearing_metadata(self):
        auth = main.AuthorizationServer()
        url = "https://client.example.com/client.json"
        cases = [
            ({"token_endpoint_auth_method": "client_secret_basic"}, "shared-secret"),
            ({"client_secret": "secret"}, "client secrets"),
            ({"client_secret_expires_at": 0}, "client secrets"),
            ({"private_key": "secret"}, "private keys"),
            (
                {"jwks": {"keys": [{"kty": "RSA", "n": "public", "e": "AQAB", "d": "secret"}]}},
                "public keys only",
            ),
        ]
        for extra, error in cases:
            with self.subTest(extra=extra):
                with self.assertRaisesRegex(ValueError, error):
                    auth.enroll_cimd(url, {**cimd_document(url), **extra})

    def test_dcr_fallback_declares_application_type(self):
        auth = main.AuthorizationServer(supports_cimd=False)
        client = main.Client(application_type="native")
        client_id = client.enroll(auth)
        self.assertEqual(auth.clients[client_id]["application_type"], "native")
        self.assertEqual(auth.clients[client_id]["enrollment"], "dcr-compatibility")

    def test_dcr_rejects_missing_application_type(self):
        auth = main.AuthorizationServer(supports_cimd=False)
        with self.assertRaisesRegex(ValueError, "application_type"):
            auth.dynamic_register({"redirect_uris": ["http://127.0.0.1/callback"]})

    def test_web_client_rejects_loopback_redirect(self):
        auth = main.AuthorizationServer()
        document = {
            "client_id": main.CLIENT_METADATA_URL,
            "client_name": "Web client",
            "application_type": "web",
            "redirect_uris": ["http://127.0.0.1/callback"],
        }
        with self.assertRaisesRegex(ValueError, "remote HTTPS"):
            auth.enroll_cimd(main.CLIENT_METADATA_URL, document)

    def test_redirect_entries_must_be_valid_uri_strings(self):
        auth = main.AuthorizationServer()
        malformed_redirects = ([123], ["not-a-uri"], ["https:///callback"], [""])
        for redirect_uris in malformed_redirects:
            with self.subTest(redirect_uris=redirect_uris):
                document = {
                    **cimd_document(main.CLIENT_METADATA_URL),
                    "redirect_uris": redirect_uris,
                }
                with self.assertRaisesRegex(ValueError, "non-empty absolute URIs"):
                    auth.enroll_cimd(main.CLIENT_METADATA_URL, document)

    def test_redirect_uri_fragments_are_rejected_before_web_policy(self):
        auth = main.AuthorizationServer(supports_cimd=False)
        with self.assertRaisesRegex(ValueError, "without fragments"):
            auth.dynamic_register(
                {
                    "application_type": "web",
                    "redirect_uris": ["https://client.example.com/callback#fragment"],
                }
            )

    def test_authorization_response_issuer_is_validated(self):
        auth = main.AuthorizationServer()
        client = main.Client()
        client.enroll(auth)
        real_authorize = auth.authorize

        def wrong_issuer(**kwargs):
            response = real_authorize(**kwargs)
            response["iss"] = "https://attacker.example"
            return response

        auth.authorize = wrong_issuer
        with self.assertRaisesRegex(ValueError, "issuer mismatch"):
            client.authorize(auth, main.RESOURCE, {"notes:read"})

    def test_wrong_client_and_verifier_do_not_consume_authorization_code(self):
        auth, client, client_id, verifier, code = self.authorization_code()
        exchange = {
            "code": code,
            "client_id": client_id,
            "verifier": verifier,
            "redirect_uri": client.redirect_uri,
            "resource": main.RESOURCE,
        }

        with self.assertRaisesRegex(ValueError, "client_id mismatch"):
            auth.exchange(**{**exchange, "client_id": "other-client"})
        self.assertIn(code, auth.pending_codes)
        with self.assertRaisesRegex(ValueError, "redirect_uri mismatch"):
            auth.exchange(**{**exchange, "redirect_uri": "https://client.example/other"})
        self.assertIn(code, auth.pending_codes)
        with self.assertRaisesRegex(ValueError, "resource mismatch"):
            auth.exchange(**{**exchange, "resource": "https://other.example/mcp"})
        self.assertIn(code, auth.pending_codes)
        with self.assertRaisesRegex(ValueError, "PKCE mismatch"):
            auth.exchange(**{**exchange, "verifier": "wrong-verifier"})
        self.assertIn(code, auth.pending_codes)

        token = auth.exchange(**exchange)

        self.assertEqual(token.client_id, client_id)
        self.assertNotIn(code, auth.pending_codes)

    def test_concurrent_valid_redemption_has_exactly_one_success(self):
        auth, client, client_id, verifier, code = self.authorization_code()
        barrier = threading.Barrier(2)

        def redeem():
            barrier.wait(timeout=2)
            try:
                return auth.exchange(
                    code=code,
                    client_id=client_id,
                    verifier=verifier,
                    redirect_uri=client.redirect_uri,
                    resource=main.RESOURCE,
                )
            except ValueError as error:
                return error

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: redeem(), range(2)))

        self.assertEqual(sum(isinstance(value, main.Token) for value in outcomes), 1)
        self.assertEqual(sum(isinstance(value, ValueError) for value in outcomes), 1)
        self.assertNotIn(code, auth.pending_codes)

    def test_authorization_code_is_invalid_at_expiry_boundary(self):
        auth, client, client_id, verifier, code = self.authorization_code()
        expires_at = auth.pending_codes[code]["expires_at"]

        with patch.object(main.time, "time", return_value=expires_at):
            with self.assertRaisesRegex(ValueError, "invalid authorization code"):
                auth.exchange(
                    code=code,
                    client_id=client_id,
                    verifier=verifier,
                    redirect_uri=client.redirect_uri,
                    resource=main.RESOURCE,
                )

        self.assertNotIn(code, auth.pending_codes)

    def test_credentials_are_keyed_by_issuer(self):
        first = main.AuthorizationServer(issuer="https://auth-one.example", supports_cimd=False)
        second = main.AuthorizationServer(issuer="https://auth-two.example", supports_cimd=False)
        client = main.Client()
        first_id = client.enroll(first)
        second_id = client.enroll(second)
        self.assertEqual(set(client.client_ids_by_issuer), {first.issuer, second.issuer})
        self.assertNotEqual(first_id, second_id)

    def test_resource_rejects_other_audience_with_json_rpc_error(self):
        server = main.ResourceServer()
        token = main.Token(
            value="t",
            issuer=server.issuer,
            audience="https://other.example/mcp",
            subject="alice",
            client_id="c",
            scopes=frozenset({"notes:read"}),
            expires_at=10**20,
        )
        body, headers = main.make_mcp_request(21, "notes.list")
        status, response, response_headers = server.call(body, headers, token)
        self.assertEqual(status, 401)
        self.assertEqual(response["jsonrpc"], "2.0")
        self.assertEqual(response["id"], 21)
        self.assertEqual(response["error"]["code"], -32001)
        self.assertIn(main.RESOURCE_METADATA_URI, response_headers["WWW-Authenticate"])

    def test_step_up_requests_only_missing_scope(self):
        auth = main.AuthorizationServer()
        server = main.ResourceServer()
        client = main.Client()
        status, response, _ = client.call_with_step_up("notes.delete", server, auth)
        self.assertEqual(status, 200)
        self.assertEqual(response["result"]["resultType"], "complete")
        token = client.tokens_by_issuer_resource[(auth.issuer, server.resource)]
        self.assertEqual(token.scopes, frozenset({"notes:read", "notes:delete"}))

    def test_routing_header_mismatch_is_json_rpc_400(self):
        server = main.ResourceServer()
        body, headers = main.make_mcp_request(31, "notes.list")
        headers["Mcp-Name"] = "notes.delete"
        status, response, _ = server.call(body, headers, None)
        self.assertEqual(status, 400)
        self.assertEqual(response["id"], 31)
        self.assertEqual(response["error"]["code"], -32020)

    def test_unicode_mcp_name_uses_and_decodes_base64_sentinel(self):
        name = "notes.検索"
        body, headers = main.make_mcp_request(37, name)
        self.assertTrue(headers["Mcp-Name"].startswith(main.BASE64_SENTINEL_PREFIX))
        params = main.ResourceServer._validate_wire(body, headers)
        self.assertEqual(params["name"], name)

    def test_malformed_base64_mcp_name_is_rejected(self):
        server = main.ResourceServer()
        body, headers = main.make_mcp_request(38, "notes.list")
        headers["Mcp-Name"] = "=?base64?%%%?="
        status, response, _ = server.call(body, headers, None)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)

    def test_header_version_mismatch_precedes_support_check(self):
        server = main.ResourceServer()
        body, headers = main.make_tools_list_request(32)
        body["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        status, response, _ = server.handle(body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["error"]["code"], -32020)

    def test_unsupported_version_has_exact_error_data(self):
        server = main.ResourceServer()
        body, headers = main.make_tools_list_request(33)
        requested = "2025-11-25"
        body["params"]["_meta"][main.PROTOCOL_META] = requested
        headers["MCP-Protocol-Version"] = requested
        status, response, _ = server.handle(body, headers)
        self.assertEqual(status, 400)
        self.assertEqual(response["id"], 33)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": requested},
        )

    def test_unknown_method_is_json_rpc_404(self):
        server = main.ResourceServer()
        body, headers = main.make_tools_list_request(34)
        body["method"] = "widgets/list"
        headers["Mcp-Method"] = "widgets/list"
        status, response, _ = server.handle(body, headers)
        self.assertEqual(status, 404)
        self.assertEqual(response["id"], 34)
        self.assertEqual(response["error"]["code"], -32601)

    def test_accepted_notification_returns_empty_202(self):
        server = main.ResourceServer()
        body, headers = main.make_tools_list_request(35)
        del body["id"]
        self.assertEqual(server.handle(body, headers), (202, None, {}))

    def test_mcp_request_has_no_session_identifier(self):
        body, headers = main.make_mcp_request(1, "notes.list")
        self.assertNotIn("Mcp-Session-Id", headers)
        self.assertEqual(body["params"]["_meta"][main.PROTOCOL_META], main.PROTOCOL_VERSION)
        self.assertIn(main.CLIENT_CAPABILITIES_META, body["params"]["_meta"])

    def test_modern_http_entrypoint_error_is_json_rpc_envelope(self):
        server = main.ResourceServer()
        body, headers = main.make_discover_request(36)
        status, response, _ = server.discover(body, headers, http_method="GET")
        self.assertEqual(status, 405)
        self.assertEqual(response["jsonrpc"], "2.0")
        self.assertEqual(response["id"], 36)
        self.assertIn("error", response)


if __name__ == "__main__":
    unittest.main()
