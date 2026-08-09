import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("integration_lab", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class IntegrationLabTests(unittest.TestCase):
    def test_selects_mcp_for_dynamic_discovery(self):
        requirements = MODULE.IntegrationRequirements(dynamic_discovery=True)
        self.assertEqual(MODULE.select_protocol(requirements), "mcp")

    def test_rejects_ambiguous_primary_protocol(self):
        requirements = MODULE.IntegrationRequirements(dynamic_discovery=True, direct_service_call=True)
        with self.assertRaises(ValueError):
            MODULE.select_protocol(requirements)

    def test_cli_long_job_requires_durable_wrapper(self):
        requirements = MODULE.IntegrationRequirements(local_automation=True, long_running=True)
        self.assertEqual(MODULE.select_protocol(requirements), "cli-with-durable-job")

    def test_authorization_rejects_missing_scope(self):
        principal = MODULE.Principal("p", frozenset({"tickets:read"}))
        tool = MODULE.ToolContract("refund", "Issue refund", frozenset({"refunds:write"}), "high")
        decision = MODULE.authorize(principal, tool)
        self.assertFalse(decision.allowed)
        self.assertIn("refunds:write", decision.reason)

    def test_approval_is_checked_after_scope(self):
        principal = MODULE.Principal("p", frozenset({"refunds:write"}))
        tool = MODULE.ToolContract("refund", "Issue refund", frozenset({"refunds:write"}), "high", True)
        self.assertEqual(MODULE.authorize(principal, tool).reason, "fresh human approval required")

    def test_fresh_approval_allows_action(self):
        principal = MODULE.Principal("p", frozenset({"refunds:write"}), frozenset({"refund"}))
        tool = MODULE.ToolContract("refund", "Issue refund", frozenset({"refunds:write"}), "high", True)
        self.assertTrue(MODULE.authorize(principal, tool).allowed)

    def test_discovery_hides_tools_outside_scope(self):
        principal = MODULE.Principal("p", frozenset({"tickets:read"}))
        tools = [
            MODULE.ToolContract("read", "Read", frozenset({"tickets:read"}), "low"),
            MODULE.ToolContract("delete", "Delete", frozenset({"accounts:delete"}), "high"),
        ]
        self.assertEqual([tool.name for tool in MODULE.discover_tools(principal, tools)], ["read"])

    def test_execution_returns_structured_authorization_error(self):
        principal = MODULE.Principal("p", frozenset())
        tool = MODULE.ToolContract("read", "Read", frozenset({"tickets:read"}), "low")
        result = MODULE.execute_tool(principal, tool, {})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["category"], "authorization")


if __name__ == "__main__":
    unittest.main()

