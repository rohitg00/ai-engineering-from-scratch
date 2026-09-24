import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ClientRegistrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.servers = main.build_authorization_servers()

    def test_pre_registered_wins_even_when_cimd_is_advertised(self) -> None:
        decision = main.choose_registration_path(self.servers["https://auth.acme-ops.example"], main.PRE_REGISTERED)
        self.assertEqual(decision.path, "pre-registered")
        self.assertFalse(decision.deprecated)

    def test_cimd_chosen_when_advertised_and_not_pre_registered(self) -> None:
        decision = main.choose_registration_path(self.servers["https://auth.acme-ops.example"], {})
        self.assertEqual(decision.path, "cimd")

    def test_dcr_fallback_is_marked_deprecated(self) -> None:
        decision = main.choose_registration_path(self.servers["https://login.legacy-crm.example"], {})
        self.assertEqual(decision.path, "dcr")
        self.assertTrue(decision.deprecated)

    def test_ask_user_when_no_automated_path_exists(self) -> None:
        decision = main.choose_registration_path(self.servers["https://id.partner-net.example"], {})
        self.assertEqual(decision.path, "ask-user")

    def test_valid_cimd_document_has_no_problems(self) -> None:
        problems = main.validate_cimd(main.VALID_CIMD_URL, main.VALID_CIMD_DOCUMENT)
        self.assertEqual(problems, [])

    def test_cimd_client_id_mismatch_is_rejected(self) -> None:
        problems = main.validate_cimd(main.VALID_CIMD_URL, main.MISMATCHED_CIMD_DOCUMENT)
        self.assertTrue(any("does not match" in problem for problem in problems))

    def test_cimd_http_scheme_is_rejected(self) -> None:
        problems = main.validate_cimd(main.HTTP_CIMD_URL, main.HTTP_CIMD_DOCUMENT)
        self.assertTrue(any("must use https" in problem for problem in problems))

    def test_cimd_missing_required_field_is_rejected(self) -> None:
        problems = main.validate_cimd(main.VALID_CIMD_URL, main.INCOMPLETE_CIMD_DOCUMENT)
        self.assertTrue(any("redirect_uris" in problem for problem in problems))

    def test_native_application_type_for_localhost_redirect(self) -> None:
        self.assertEqual(main.application_type_for("http://127.0.0.1:8945/callback"), "native")

    def test_web_application_type_for_remote_https_redirect(self) -> None:
        self.assertEqual(main.application_type_for("https://ops-cli.example.com/callback"), "web")

    def test_credentials_are_not_reused_across_issuers(self) -> None:
        store = main.CredentialStore()
        creds = main.ClientCredentials(
            client_id="acme-ops-cli-2024", issuer="https://auth.acme-ops.example", method="pre-registered"
        )
        store.register(creds)
        self.assertIs(store.use("https://auth.acme-ops.example", creds), creds)
        with self.assertRaises(ValueError):
            store.use("https://login.legacy-crm.example", creds)

    def test_confused_deputy_proxy_blocked_until_consent_recorded(self) -> None:
        ledger = main.ProxyConsentLedger()
        proxy_id = "https://proxy.acme.example/oauth/client-metadata.json"
        self.assertFalse(ledger.may_forward(proxy_id, "finance-bot"))
        ledger.record_consent(proxy_id, "finance-bot")
        self.assertTrue(ledger.may_forward(proxy_id, "finance-bot"))
        self.assertFalse(ledger.may_forward(proxy_id, "other-client"))

    def test_auth_extension_recommendation_by_scenario(self) -> None:
        self.assertEqual(
            main.recommend_auth_extension(has_interactive_user=False, enterprise_idp=False),
            main.CLIENT_CREDENTIALS_EXTENSION,
        )
        self.assertEqual(
            main.recommend_auth_extension(has_interactive_user=True, enterprise_idp=True),
            main.ENTERPRISE_MANAGED_EXTENSION,
        )
        self.assertIsNone(main.recommend_auth_extension(has_interactive_user=True, enterprise_idp=False))

    def test_registered_client_call_carries_bearer_token_and_required_headers(self) -> None:
        scenario = main.run_scenario()
        wrapped_requests = [entry for entry in scenario["client"].log if isinstance(entry, dict) and "http" in entry]
        self.assertEqual(len(wrapped_requests), 2)
        discover_entry, call_entry = wrapped_requests
        self.assertTrue(discover_entry["http"]["headers"]["Authorization"].startswith("Bearer cc-token."))
        self.assertEqual(discover_entry["http"]["headers"]["Mcp-Method"], "server/discover")
        self.assertEqual(call_entry["http"]["headers"]["Mcp-Name"], "list_open_incidents")
        self.assertEqual(call_entry["http"]["headers"]["Mcp-Method"], "tools/call")

    def test_every_result_in_the_transcript_carries_a_result_type(self) -> None:
        for message in main.transcript():
            if isinstance(message, dict) and "result" in message:
                self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
