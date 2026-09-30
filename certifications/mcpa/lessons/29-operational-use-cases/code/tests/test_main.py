import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class UseCaseRecommenderTests(unittest.TestCase):
    def test_local_system_recommends_a_tool_over_stdio_with_environment_credentials(self) -> None:
        profile = main.UseCaseProfile(
            name="code search", initiator="model", data_sensitivity="private", duration="instant",
            ui_need="none", human_present=True, locality="local",
        )
        rec = main.recommend(profile)
        self.assertTrue(rec.recommended)
        self.assertEqual(rec.primitive, "tool")
        self.assertEqual(rec.transport, "stdio")
        self.assertIn("environment", rec.auth)

    def test_application_initiated_case_recommends_a_resource(self) -> None:
        profile = main.UseCaseProfile(
            name="ticket context", initiator="application", data_sensitivity="private", duration="instant",
            ui_need="none", human_present=True, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertEqual(rec.primitive, "resource")

    def test_user_initiated_template_recommends_a_prompt_and_the_skills_extension(self) -> None:
        profile = main.UseCaseProfile(
            name="code review skill", initiator="user", data_sensitivity="public", duration="instant",
            ui_need="none", human_present=True, locality="remote", reusable_workflow=True,
        )
        rec = main.recommend(profile)
        self.assertEqual(rec.primitive, "prompt")
        self.assertIn(main.SKILLS_EXTENSION, rec.extensions)

    def test_long_job_recommends_the_tasks_extension(self) -> None:
        profile = main.UseCaseProfile(
            name="deploy pipeline", initiator="model", data_sensitivity="private", duration="long",
            ui_need="none", human_present=True, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertIn(main.TASKS_EXTENSION, rec.extensions)

    def test_machine_to_machine_case_recommends_the_client_credentials_extension(self) -> None:
        profile = main.UseCaseProfile(
            name="nightly sync", initiator="system", data_sensitivity="private", duration="instant",
            ui_need="none", human_present=False, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertIn(main.CLIENT_CREDENTIALS_EXTENSION, rec.extensions)
        self.assertIn("client credentials", rec.auth)

    def test_interactive_dashboard_recommends_mcp_apps_with_a_text_fallback(self) -> None:
        profile = main.UseCaseProfile(
            name="usage dashboard", initiator="model", data_sensitivity="private", duration="instant",
            ui_need="interactive", human_present=True, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertIn(main.UI_EXTENSION, rec.extensions)
        self.assertTrue(any("fallback" in line for line in rec.reasoning))

    def test_private_data_recommends_private_cache_scope(self) -> None:
        profile = main.UseCaseProfile(
            name="hr record", initiator="model", data_sensitivity="private", duration="instant",
            ui_need="none", human_present=True, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertEqual(rec.cache_scope, "private")

    def test_public_data_recommends_public_cache_scope(self) -> None:
        profile = main.UseCaseProfile(
            name="public docs", initiator="model", data_sensitivity="public", duration="instant",
            ui_need="none", human_present=True, locality="remote",
        )
        rec = main.recommend(profile)
        self.assertEqual(rec.cache_scope, "public")

    def test_enterprise_managed_deployment_recommends_the_enterprise_extension(self) -> None:
        profile = main.UseCaseProfile(
            name="hr system of record", initiator="model", data_sensitivity="private", duration="instant",
            ui_need="none", human_present=True, locality="remote", enterprise_managed=True,
        )
        rec = main.recommend(profile)
        self.assertIn(main.ENTERPRISE_AUTH_EXTENSION, rec.extensions)

    def test_no_external_system_is_not_recommended_for_mcp(self) -> None:
        profile = main.UseCaseProfile(
            name="currency formatting", initiator="model", data_sensitivity="public", duration="instant",
            ui_need="none", human_present=True, locality="local", external_system=False,
        )
        rec = main.recommend(profile)
        self.assertFalse(rec.recommended)
        self.assertIsNone(rec.primitive)

    def test_demo_transcript_discovers_then_lists_with_cache_hints(self) -> None:
        entries = main.transcript()
        self.assertEqual(entries[0]["method"], "server/discover")
        self.assertEqual(entries[1]["result"]["cacheScope"], "public")
        self.assertEqual(entries[2]["method"], "tools/list")
        self.assertEqual(entries[3]["result"]["cacheScope"], "private")
        self.assertGreaterEqual(entries[3]["result"]["ttlMs"], 0)

    def test_usage_dashboard_falls_back_to_text_without_the_ui_extension(self) -> None:
        entries = main.transcript()
        without_extension = entries[7]["result"]
        with_extension = entries[9]["result"]
        self.assertNotIn("error", entries[7])
        self.assertIn("without", without_extension["content"][0]["text"])
        self.assertIn("interactive", with_extension["content"][0]["text"])

    def test_unknown_tool_in_demo_transcript_is_a_protocol_error(self) -> None:
        entries = main.transcript()
        self.assertEqual(entries[-1]["error"]["code"], main.INVALID_PARAMS)

    def test_request_without_meta_is_rejected(self) -> None:
        server = main.build_opsdesk_server()
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unsupported_version_is_a_protocol_error_naming_supported_versions(self) -> None:
        server = main.build_opsdesk_server()
        request = main.make_request(1, "server/discover", version="1999-01-01")
        response = server.handle(request)
        self.assertEqual(response["error"]["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(response["error"]["data"]["requested"], "1999-01-01")
        self.assertEqual(response["error"]["data"]["supported"], [main.PROTOCOL_VERSION])


if __name__ == "__main__":
    unittest.main()
