import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class McpAppsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.Server("dashboards")
        self.client = main.Client(self.server)
        self.loader = main.HostAppLoader(self.client, main.HOST_TRUSTED_DOMAINS, main.HOST_GRANTED_PERMISSIONS)
        self.tools = self.client.send("tools/list")["result"]["tools"]
        self.tool = next(t for t in self.tools if t["name"] == main.TOOL_NAME)
        self.refresh_tool = next(t for t in self.tools if t["name"] == main.REFRESH_TOOL_NAME)
        self.export_tool = next(t for t in self.tools if t["name"] == main.EXPORT_TOOL_NAME)

    def test_ui_extension_is_negotiated_when_both_sides_declare_it(self) -> None:
        discover = self.client.send("server/discover", capabilities=main.UI_CAPS)
        capabilities = discover["result"]["capabilities"]
        self.assertIn(main.UI_EXTENSION, capabilities["extensions"])
        negotiated = main.negotiated_extensions(main.UI_CAPS, capabilities)
        self.assertEqual(negotiated, {main.UI_EXTENSION})

    def test_extension_not_declared_by_the_client_is_never_negotiated(self) -> None:
        discover = self.client.send("server/discover")
        capabilities = discover["result"]["capabilities"]
        negotiated = main.negotiated_extensions({}, capabilities)
        self.assertEqual(negotiated, set())

    def test_tool_list_carries_the_ui_binding_regardless_of_caller_capabilities(self) -> None:
        binding = self.tool["_meta"]["ui"]["resourceUri"]
        self.assertEqual(binding, main.RESOURCE_URI)

    def test_default_visibility_is_model_and_app_when_omitted(self) -> None:
        self.assertNotIn("visibility", self.tool["_meta"]["ui"])
        self.assertEqual(main.tool_visibility(self.tool), main.DEFAULT_VISIBILITY)

    def test_agent_visible_tools_excludes_app_only_tools(self) -> None:
        visible_names = {t["name"] for t in main.agent_visible_tools(self.tools)}
        self.assertIn(main.TOOL_NAME, visible_names)
        self.assertIn(main.EXPORT_TOOL_NAME, visible_names)
        self.assertNotIn(main.REFRESH_TOOL_NAME, visible_names)

    def test_app_aware_host_resolves_the_ui_resource_via_resources_read(self) -> None:
        plan = self.loader.load(self.tool, {"metric": "revenue"}, declare_ui=True)
        self.assertEqual(plan["mode"], "app")
        self.assertEqual(plan["mimeType"], main.UI_MIME_TYPE)
        read_requests = [m for m in self.client.log if m.get("method") == "resources/read"]
        self.assertEqual(len(read_requests), 1)
        self.assertEqual(read_requests[0]["params"]["uri"], main.RESOURCE_URI)

    def test_host_without_the_extension_falls_back_to_text_and_skips_the_resource_read(self) -> None:
        before = len(self.client.log)
        plan = self.loader.load(self.tool, {"metric": "revenue"}, declare_ui=False)
        after = len(self.client.log)
        self.assertEqual(plan["mode"], "text")
        self.assertIn("north", plan["text"])
        self.assertEqual(after - before, 2)

    def test_wrong_mime_type_is_rejected_even_though_the_read_itself_succeeds(self) -> None:
        response = self.client.send("resources/read", {"uri": main.LEGACY_RESOURCE_URI}, capabilities=main.UI_CAPS)
        self.assertNotIn("error", response)
        content = response["result"]["contents"][0]
        review = main.review_app_resource(content, main.HOST_TRUSTED_DOMAINS)
        self.assertFalse(review["accepted"])
        self.assertIn("mimeType", review["reason"])

    def test_csp_domain_outside_host_policy_is_rejected(self) -> None:
        response = self.client.send("resources/read", {"uri": main.UNTRUSTED_RESOURCE_URI}, capabilities=main.UI_CAPS)
        content = response["result"]["contents"][0]
        review = main.review_app_resource(content, main.HOST_TRUSTED_DOMAINS)
        self.assertFalse(review["accepted"])
        self.assertIn("https://evil.example.net", review["reason"])

    def test_csp_is_constructed_from_declared_domains(self) -> None:
        csp = main.build_csp({
            "connectDomains": ["https://api.sales-metrics.example"],
            "resourceDomains": ["https://cdn.trusted-charts.example"],
        })
        self.assertIn("connect-src https://api.sales-metrics.example", csp)
        self.assertIn("script-src 'self' 'unsafe-inline' https://cdn.trusted-charts.example", csp)
        self.assertIn("default-src 'none'", csp)
        self.assertIn("frame-src 'none'", csp)
        self.assertIn("base-uri 'self'", csp)

    def test_declared_csp_without_resource_domains_stays_closed(self) -> None:
        csp = main.build_csp({"connectDomains": ["https://api.sales-metrics.example"]})
        self.assertIn("default-src 'none'", csp)
        self.assertIn("script-src 'self' 'unsafe-inline';", csp + ";")
        self.assertNotIn("font-src", csp)
        self.assertIn("connect-src https://api.sales-metrics.example", csp)

    def test_omitted_csp_uses_the_restrictive_default(self) -> None:
        response = self.client.send("resources/read", {"uri": main.MINIMAL_RESOURCE_URI}, capabilities=main.UI_CAPS)
        content = response["result"]["contents"][0]
        ui_meta = content["_meta"]["ui"]
        self.assertNotIn("csp", ui_meta)
        csp = main.build_csp(ui_meta.get("csp"))
        self.assertEqual(csp, main.RESTRICTIVE_DEFAULT_CSP + "; frame-src 'none'; base-uri 'self'")
        self.assertIn("connect-src 'none'", csp)

    def test_permissions_are_granted_only_up_to_host_policy(self) -> None:
        plan = self.loader.load(self.tool, {"metric": "revenue"}, declare_ui=True)
        self.assertEqual(plan["grantedPermissions"], ["camera"])

    def test_app_initiated_call_declined_by_consent_never_reaches_the_wire(self) -> None:
        before = len(self.client.log)
        outcome = main.request_tool_call_from_app(self.client, self.refresh_tool, {}, approved=False)
        after = len(self.client.log)
        self.assertFalse(outcome["routed"])
        self.assertEqual(before, after)

    def test_app_initiated_call_approved_by_consent_is_forwarded_with_a_fresh_id(self) -> None:
        first = main.request_tool_call_from_app(self.client, self.refresh_tool, {}, approved=True)
        second = main.request_tool_call_from_app(self.client, self.refresh_tool, {}, approved=True)
        self.assertTrue(first["routed"])
        self.assertTrue(second["routed"])
        self.assertNotEqual(first["response"]["id"], second["response"]["id"])
        self.assertEqual(second["response"]["result"]["resultType"], "complete")

    def test_app_initiated_call_blocked_by_tool_visibility_regardless_of_consent(self) -> None:
        before = len(self.client.log)
        outcome = main.request_tool_call_from_app(self.client, self.export_tool, {}, approved=True)
        after = len(self.client.log)
        self.assertFalse(outcome["routed"])
        self.assertIn("visibility", outcome["reason"])
        self.assertEqual(before, after)

    def test_unknown_resource_is_a_protocol_error(self) -> None:
        response = self.client.send("resources/read", {"uri": "ui://dashboard/does-not-exist.html"}, capabilities=main.UI_CAPS)
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_cacheable_results_carry_ttl_and_scope(self) -> None:
        discover = self.client.send("server/discover", capabilities=main.UI_CAPS)
        listing = self.client.send("resources/list")
        read = self.client.send("resources/read", {"uri": main.RESOURCE_URI}, capabilities=main.UI_CAPS)
        for response in (discover, listing, read):
            result = response["result"]
            self.assertIsInstance(result["ttlMs"], int)
            self.assertGreaterEqual(result["ttlMs"], 0)
            self.assertIn(result["cacheScope"], {"public", "private"})


if __name__ == "__main__":
    unittest.main()
