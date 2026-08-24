import hashlib
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    AUTHORIZATION_CODE_TTL_SECONDS,
    MCP_RESOURCE,
    OTHER_MCP_RESOURCE,
    AuthorizationServer,
    Client,
    ResourceServer,
    b64url,
    protected_resource_metadata_url,
)


def ready_authorization_server(issuer="https://auth.example.com"):
    server = AuthorizationServer(issuer=issuer)
    server.rotate_key()
    return server


def cimd_client(server, url="https://client.example.com/oauth/client.json"):
    return Client(
        name="Test client",
        auth_server=server,
        client_metadata_url=url,
        client_metadata={
            "client_id": url,
            "client_name": "Test client",
            "redirect_uris": ["http://127.0.0.1:7333/callback"],
            "grant_types": ["authorization_code"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
    )


class ProductionAuthTests(unittest.TestCase):
    def test_cimd_uses_document_url_as_client_id(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        self.assertEqual(client.client_metadata_url, client_id)
        self.assertEqual("cimd", auth.clients[client_id]["enrollment"])

    def test_cimd_rejects_document_identity_mismatch(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.client_metadata["client_id"] = "https://attacker.example/client.json"
        with self.assertRaisesRegex(ValueError, "must equal"):
            client.enroll()

    def test_cimd_requires_a_document_path(self):
        auth = ready_authorization_server()
        client = cimd_client(auth, url="https://client.example.com")
        with self.assertRaisesRegex(ValueError, "with a path"):
            client.enroll()

    def test_cimd_requires_client_name_and_redirect_uris(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.client_metadata["client_name"] = "   "
        with self.assertRaisesRegex(ValueError, "client_name"):
            client.enroll()
        for redirect_uris in ([], [""], "https://client.example.com/callback"):
            with self.subTest(redirect_uris=redirect_uris):
                client = cimd_client(auth)
                client.client_metadata["redirect_uris"] = redirect_uris
                with self.assertRaisesRegex(ValueError, "redirect URI"):
                    client.enroll()

    def test_cimd_does_not_require_dcr_application_type(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        self.assertIsNone(auth.clients[client_id]["application_type"])

    def test_dcr_requires_application_type(self):
        auth = ready_authorization_server()
        response = auth.register_client(
            {"redirect_uris": ["http://127.0.0.1/callback"]}
        )
        self.assertEqual(400, response["status"])

    def test_web_dcr_rejects_insecure_redirect(self):
        auth = ready_authorization_server()
        response = auth.register_client(
            {
                "application_type": "web",
                "redirect_uris": ["http://app.example.com/callback"],
            }
        )
        self.assertEqual("invalid_redirect_uri", response["body"]["error"])

    def test_web_cimd_rejects_insecure_redirect(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.client_metadata.update(
            {
                "application_type": "web",
                "redirect_uris": ["http://app.example.com/callback"],
            }
        )
        with self.assertRaisesRegex(ValueError, "HTTPS redirect URIs"):
            client.enroll()

    def test_web_redirects_require_absolute_https_host_without_fragment(self):
        auth = ready_authorization_server()
        invalid_redirects = (
            "https:///callback",
            "https://app.example.com/callback#fragment",
        )
        for redirect_uri in invalid_redirects:
            with self.subTest(redirect_uri=redirect_uri, enrollment="cimd"):
                client = cimd_client(auth)
                client.client_metadata.update(
                    {
                        "application_type": "web",
                        "redirect_uris": [redirect_uri],
                    }
                )
                with self.assertRaisesRegex(
                    ValueError,
                    "absolute redirect URIs|host and no fragment",
                ):
                    client.enroll()
            with self.subTest(redirect_uri=redirect_uri, enrollment="dcr"):
                response = auth.register_client(
                    {
                        "application_type": "web",
                        "redirect_uris": [redirect_uri],
                    }
                )
                self.assertEqual(response["status"], 400)
                self.assertEqual(response["body"]["error"], "invalid_redirect_uri")

    def test_web_redirects_reject_malformed_and_out_of_range_ports(self):
        auth = ready_authorization_server()
        invalid_redirects = (
            "https://app.example.com:not-a-port/callback",
            "https://app.example.com:65536/callback",
        )
        for redirect_uri in invalid_redirects:
            with self.subTest(redirect_uri=redirect_uri, enrollment="cimd"):
                client = cimd_client(auth)
                client.client_metadata.update(
                    {
                        "application_type": "web",
                        "redirect_uris": [redirect_uri],
                    }
                )
                with self.assertRaisesRegex(ValueError, "absolute redirect URIs"):
                    client.enroll()

            with self.subTest(redirect_uri=redirect_uri, enrollment="dcr"):
                response = auth.register_client(
                    {
                        "application_type": "web",
                        "redirect_uris": [redirect_uri],
                    }
                )
                self.assertEqual(400, response["status"])
                self.assertEqual("invalid_redirect_uri", response["body"]["error"])

    def test_every_cimd_and_dcr_redirect_is_absolute_and_fragment_free(self):
        auth = ready_authorization_server()
        invalid_redirects = (
            "callback",
            "/callback",
            "custom:/callback#fragment",
            "https://app.example.com/callback#fragment",
        )
        for application_type in (None, "native", "web"):
            for redirect_uri in invalid_redirects:
                with self.subTest(
                    enrollment="cimd",
                    application_type=application_type,
                    redirect_uri=redirect_uri,
                ):
                    client = cimd_client(auth)
                    client.client_metadata["redirect_uris"] = [redirect_uri]
                    if application_type is not None:
                        client.client_metadata["application_type"] = application_type
                    with self.assertRaisesRegex(ValueError, "absolute redirect URIs"):
                        client.enroll()

        for application_type in ("native", "web"):
            for redirect_uri in invalid_redirects:
                with self.subTest(
                    enrollment="dcr",
                    application_type=application_type,
                    redirect_uri=redirect_uri,
                ):
                    response = auth.register_client(
                        {
                            "application_type": application_type,
                            "redirect_uris": [redirect_uri],
                        }
                    )
                    self.assertEqual(response["status"], 400)
                    self.assertEqual(
                        response["body"]["error"], "invalid_redirect_uri"
                    )

    def test_native_redirect_policy_rejects_remote_cleartext_http(self):
        auth = ready_authorization_server()
        response = auth.register_client(
            {
                "application_type": "native",
                "redirect_uris": ["http://app.example.com/callback"],
            }
        )
        self.assertEqual(response["status"], 400)
        self.assertEqual(response["body"]["error"], "invalid_redirect_uri")

    def test_native_redirect_policy_rejects_registered_and_generic_schemes(self):
        auth = ready_authorization_server()
        invalid_redirects = (
            "javascript:alert(1)",
            "data:text/plain,callback",
            "ftp://app.example.com/callback",
            "urn:ietf:wg:oauth:2.0:oob",
        )
        for index, redirect_uri in enumerate(invalid_redirects):
            with self.subTest(
                enrollment="cimd_omitted_application_type",
                redirect_uri=redirect_uri,
            ):
                client = cimd_client(auth)
                client.client_metadata["redirect_uris"] = [redirect_uri]
                with self.assertRaisesRegex(ValueError, "domain-based private-use"):
                    client.enroll()

            with self.subTest(enrollment="cimd", redirect_uri=redirect_uri):
                client = cimd_client(auth)
                client.client_metadata.update(
                    {
                        "application_type": "native",
                        "redirect_uris": [redirect_uri],
                    }
                )
                with self.assertRaisesRegex(ValueError, "domain-based private-use"):
                    client.enroll()

            with self.subTest(enrollment="dcr", redirect_uri=redirect_uri):
                response = auth.register_client(
                    {
                        "application_type": "native",
                        "redirect_uris": [redirect_uri],
                    }
                )
                self.assertEqual(400, response["status"])
                self.assertEqual("invalid_redirect_uri", response["body"]["error"])

            with self.subTest(enrollment="pre_registered", redirect_uri=redirect_uri):
                client_id = f"invalid-scheme-client-{index}"
                with self.assertRaisesRegex(ValueError, "domain-based private-use"):
                    auth.pre_register_client(
                        client_id,
                        redirect_uris=[redirect_uri],
                        client_name="Invalid native client",
                    )
                self.assertNotIn(client_id, auth.clients)

    def test_native_redirect_policy_accepts_domain_based_private_use_scheme(self):
        auth = ready_authorization_server()
        redirect_uri = "com.example.app:/oauth2redirect"

        client = cimd_client(auth)
        client.client_metadata.update(
            {
                "application_type": "native",
                "redirect_uris": [redirect_uri],
            }
        )
        cimd_client_id = client.enroll()
        self.assertEqual([redirect_uri], auth.clients[cimd_client_id]["redirect_uris"])

        response = auth.register_client(
            {
                "application_type": "native",
                "redirect_uris": [redirect_uri],
            }
        )
        self.assertEqual(201, response["status"])

        pre_registered_id = auth.pre_register_client(
            "private-use-client",
            redirect_uris=[redirect_uri],
            client_name="Private-use native client",
        )
        self.assertEqual(
            [redirect_uri],
            auth.clients[pre_registered_id]["redirect_uris"],
        )

    def test_dcr_fallback_records_native_application_type(self):
        auth = ready_authorization_server()
        client = Client(name="Fallback client", auth_server=auth)
        client.discover()
        client_id = client.register()
        self.assertEqual("native", auth.clients[client_id]["application_type"])
        self.assertEqual(client_id, client.client_ids_by_issuer[auth.issuer])

    def test_pre_registered_client_is_used_before_cimd_or_dcr(self):
        auth = ready_authorization_server()
        client_id = auth.pre_register_client(
            "pre-client",
            redirect_uris=["http://127.0.0.1:7333/callback"],
            client_name="Pre-registered client",
        )
        client = Client(
            name="Pre-registered client",
            auth_server=auth,
            pre_registered_client_ids_by_issuer={auth.issuer: client_id},
        )
        self.assertEqual(client_id, client.enroll())
        self.assertEqual("pre_registered", auth.clients[client_id]["enrollment"])

    def test_pre_registered_redirects_follow_runtime_registration_policy(self):
        auth = ready_authorization_server()
        invalid_redirects = (
            ("native", "http://app.example.com/callback"),
            ("native", "/callback"),
            ("web", "http://127.0.0.1:7333/callback"),
            ("web", "https://app.example.com/callback#fragment"),
        )
        for index, (application_type, redirect_uri) in enumerate(invalid_redirects):
            client_id = f"invalid-pre-client-{index}"
            with self.subTest(
                application_type=application_type,
                redirect_uri=redirect_uri,
            ):
                with self.assertRaisesRegex(ValueError, "redirect URI"):
                    auth.pre_register_client(
                        client_id,
                        redirect_uris=[redirect_uri],
                        client_name="Pre-registered client",
                        application_type=application_type,
                    )
                self.assertNotIn(client_id, auth.clients)

        client_id = auth.pre_register_client(
            "valid-web-client",
            redirect_uris=["https://app.example.com/callback"],
            client_name="Pre-registered web client",
            application_type="web",
        )
        self.assertEqual("web", auth.clients[client_id]["application_type"])

    def test_protected_resource_metadata_inserts_well_known_before_resource_path(self):
        self.assertEqual(
            "https://mcp.example.com/.well-known/oauth-protected-resource/team/server",
            protected_resource_metadata_url("https://mcp.example.com/team/server"),
        )
        self.assertEqual(
            "https://mcp.example.com/.well-known/oauth-protected-resource",
            protected_resource_metadata_url("https://mcp.example.com"),
        )

    def test_authorization_response_issuer_mismatch_is_rejected(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.discover()
        with self.assertRaisesRegex(ValueError, "issuer mismatch"):
            client.validate_authorization_response_issuer("https://evil.example.com")

    def test_advertised_response_issuer_cannot_be_omitted(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.discover()
        with self.assertRaisesRegex(ValueError, "omitted"):
            client.validate_authorization_response_issuer(None)

    def test_authorize_validates_the_issuer_from_the_actual_response(self):
        class MixupAuthorizationServer(AuthorizationServer):
            def begin_authorization(self, **kwargs):
                response = super().begin_authorization(**kwargs)
                response["iss"] = "https://evil.example.com"
                return response

        auth = MixupAuthorizationServer()
        auth.rotate_key()
        client = cimd_client(auth)
        client.enroll()
        with self.assertRaisesRegex(ValueError, "issuer mismatch"):
            client.authorize({"mcp:tools.invoke"}, MCP_RESOURCE, "alice")

    def test_pkce_verifier_is_checked_before_code_redemption(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        redirect_uri = client.client_metadata["redirect_uris"][0]
        response = auth.begin_authorization(
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge="not-the-wrong-verifier-hash",
            code_challenge_method="S256",
            scopes={"mcp:tools.invoke"},
            resource=MCP_RESOURCE,
            user="alice",
        )
        with self.assertRaisesRegex(ValueError, "code_verifier"):
            auth.redeem_code(
                code=response["code"],
                client_id=client_id,
                redirect_uri=redirect_uri,
                code_verifier="wrong-verifier",
                resource=MCP_RESOURCE,
            )
        self.assertIn(response["code"], auth.authorization_codes)

    def test_authorization_requires_s256_challenge_method(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        with self.assertRaisesRegex(ValueError, "code_challenge_method S256"):
            auth.begin_authorization(
                client_id=client_id,
                redirect_uri=client.client_metadata["redirect_uris"][0],
                code_challenge="challenge",
                code_challenge_method="plain",
                scopes={"mcp:tools.invoke"},
                resource=MCP_RESOURCE,
                user="alice",
            )

    def test_authorization_code_expires_and_is_removed(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        redirect_uri = client.client_metadata["redirect_uris"][0]
        with patch("main.time.time", return_value=1_000):
            response = auth.begin_authorization(
                client_id=client_id,
                redirect_uri=redirect_uri,
                code_challenge="challenge",
                code_challenge_method="S256",
                scopes={"mcp:tools.invoke"},
                resource=MCP_RESOURCE,
                user="alice",
            )
        record = auth.authorization_codes[response["code"]]
        self.assertEqual(record["code_challenge_method"], "S256")
        self.assertEqual(record["expires_at"], 1_000 + AUTHORIZATION_CODE_TTL_SECONDS)
        with patch("main.time.time", return_value=1_301):
            with self.assertRaisesRegex(ValueError, "expired"):
                auth.redeem_code(
                    code=response["code"],
                    client_id=client_id,
                    redirect_uri=redirect_uri,
                    code_verifier="irrelevant-after-expiry",
                    resource=MCP_RESOURCE,
                )
        self.assertNotIn(response["code"], auth.authorization_codes)

    def test_authorization_code_redemption_is_atomic(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        redirect_uri = client.client_metadata["redirect_uris"][0]
        verifier = "two-thread-verifier"
        challenge = b64url(hashlib.sha256(verifier.encode()).digest())
        response = auth.begin_authorization(
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=challenge,
            code_challenge_method="S256",
            scopes={"mcp:tools.invoke"},
            resource=MCP_RESOURCE,
            user="alice",
        )
        barrier = threading.Barrier(2)

        def redeem() -> tuple[str, str]:
            barrier.wait(timeout=2)
            try:
                return (
                    "success",
                    auth.redeem_code(
                        code=response["code"],
                        client_id=client_id,
                        redirect_uri=redirect_uri,
                        code_verifier=verifier,
                        resource=MCP_RESOURCE,
                    ),
                )
            except ValueError as exc:
                return "error", str(exc)

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: redeem(), range(2)))

        self.assertEqual(sum(kind == "success" for kind, _ in outcomes), 1)
        self.assertEqual(sum(kind == "error" for kind, _ in outcomes), 1)
        error_messages = [value for kind, value in outcomes if kind == "error"]
        self.assertEqual(
            error_messages,
            ["authorization code is invalid or already used"],
        )

    def test_new_authorization_prunes_abandoned_expired_codes(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client_id = client.enroll()
        redirect_uri = client.client_metadata["redirect_uris"][0]
        request = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "code_challenge": "challenge",
            "code_challenge_method": "S256",
            "scopes": {"mcp:tools.invoke"},
            "resource": MCP_RESOURCE,
            "user": "alice",
        }
        with patch("main.time.time", return_value=1_000):
            abandoned = auth.begin_authorization(**request)["code"]
        with patch("main.time.time", return_value=1_200):
            active = auth.begin_authorization(**request)["code"]
        with patch("main.time.time", return_value=1_301):
            newest = auth.begin_authorization(**request)["code"]

        self.assertNotIn(abandoned, auth.authorization_codes)
        self.assertIn(active, auth.authorization_codes)
        self.assertIn(newest, auth.authorization_codes)

    def test_authorization_code_is_single_use_and_token_cache_is_resource_bound(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.enroll()
        client.authorize({"mcp:tools.invoke"}, MCP_RESOURCE, "alice")
        client.authorize({"mcp:tools.invoke"}, OTHER_MCP_RESOURCE, "alice")
        self.assertFalse(auth.authorization_codes)
        self.assertEqual(
            {
                (auth.issuer, MCP_RESOURCE),
                (auth.issuer, OTHER_MCP_RESOURCE),
            },
            set(client.access_tokens_by_issuer_resource),
        )

    def test_credentials_are_not_reused_across_issuers(self):
        first = ready_authorization_server("https://first.example.com")
        second = ready_authorization_server("https://second.example.com")
        client = cimd_client(first)
        first_id = client.enroll()
        client.use_authorization_server(second)
        with self.assertRaisesRegex(ValueError, "enroll separately"):
            client.authorize({"mcp:tools.invoke"}, MCP_RESOURCE, "alice")
        second_id = client.enroll()
        self.assertEqual(first_id, second_id)
        self.assertEqual(
            {first.issuer, second.issuer}, set(client.client_ids_by_issuer)
        )
        self.assertIn(second_id, second.clients)

    def test_resource_server_rejects_cross_resource_token(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.enroll()
        token = client.authorize({"mcp:tools.invoke"}, MCP_RESOURCE, "alice")
        other = ResourceServer(
            resource=OTHER_MCP_RESOURCE,
            auth_server=auth,
            allowed_issuers=[auth.issuer],
        )
        result = other.call_tool("tasks.list", token)
        self.assertEqual(401, result["status"])
        self.assertIn("audience mismatch", result["WWW-Authenticate"])

    def test_scope_is_checked_on_each_tool_call(self):
        auth = ready_authorization_server()
        client = cimd_client(auth)
        client.enroll()
        token = client.authorize({"mcp:tools.invoke"}, MCP_RESOURCE, "alice")
        resource = ResourceServer(
            resource=MCP_RESOURCE,
            auth_server=auth,
            allowed_issuers=[auth.issuer],
        )
        result = resource.call_tool("notes.delete", token)
        self.assertEqual(403, result["status"])
        self.assertIn("mcp:tools.delete", result["WWW-Authenticate"])


if __name__ == "__main__":
    unittest.main()
