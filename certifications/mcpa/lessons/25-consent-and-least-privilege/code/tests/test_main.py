import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ConsentAndLeastPrivilegeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.build_files_server()
        self.client = main.Client(self.server)

    def test_read_only_tool_proceeds_without_any_prompt(self) -> None:
        response = self.client.call("list_files", {})
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertFalse(response["result"]["isError"])

    def test_destructive_tool_triggers_elicitation(self) -> None:
        response = self.client.call("delete_file", {"path": "notes.txt"})
        self.assertEqual(response["result"]["resultType"], "input_required")
        confirm = response["result"]["inputRequests"]["confirm"]
        self.assertEqual(confirm["method"], "elicitation/create")
        self.assertIn("requestState", response["result"])

    def test_decline_prevents_the_call_and_leaves_no_side_effect(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        response = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "decline"}},
            request_state=prompt["result"]["requestState"],
        )
        self.assertTrue(response["result"]["isError"])
        self.assertNotIn("error", response)
        self.assertIn("notes.txt", self.server.filesystem)

    def test_accept_without_approval_does_not_run_the_tool(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        response = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": False}}},
            request_state=prompt["result"]["requestState"],
        )
        self.assertTrue(response["result"]["isError"])
        self.assertIn("notes.txt", self.server.filesystem)

    def test_cancel_also_prevents_the_call(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        response = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "cancel"}},
            request_state=prompt["result"]["requestState"],
        )
        self.assertTrue(response["result"]["isError"])
        self.assertIn("notes.txt", self.server.filesystem)

    def test_accept_runs_the_tool_and_is_remembered_for_that_tool(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        response = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=prompt["result"]["requestState"],
        )
        self.assertFalse(response["result"]["isError"])
        self.assertNotIn("notes.txt", self.server.filesystem)
        self.assertTrue(self.server.gate.has("delete_file"))
        second = self.client.call("delete_file", {"path": "report.csv"})
        self.assertEqual(second["result"]["resultType"], "complete")

    def test_tampered_retry_arguments_are_rejected_without_consuming_state(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        state = prompt["result"]["requestState"]
        tampered = self.client.call(
            "delete_file", {"path": "report.csv"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=state,
        )
        self.assertTrue(tampered["result"]["isError"])
        self.assertIn("report.csv", self.server.filesystem)
        self.assertIn("notes.txt", self.server.filesystem)
        legitimate = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=state,
        )
        self.assertFalse(legitimate["result"]["isError"])
        self.assertNotIn("notes.txt", self.server.filesystem)

    def test_a_consumed_request_state_cannot_be_replayed(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        state = prompt["result"]["requestState"]
        self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "decline"}},
            request_state=state,
        )
        replay = self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=state,
        )
        self.assertTrue(replay["result"]["isError"])
        self.assertIn("notes.txt", self.server.filesystem)
        self.assertFalse(self.server.gate.has("delete_file"))

    def test_approving_one_tool_does_not_approve_a_different_tool(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=prompt["result"]["requestState"],
        )
        self.assertTrue(self.server.gate.has("delete_file"))
        other = self.client.call("send_payment", {"payee": "acme", "amountUsd": 10}, scopes=frozenset({"payments:write"}))
        self.assertEqual(other["result"]["resultType"], "input_required")

    def test_open_world_read_only_tool_still_needs_consent(self) -> None:
        response = self.client.call("search_web", {"query": "mcp"})
        self.assertEqual(response["result"]["resultType"], "input_required")

    def test_step_up_computes_the_union_of_previous_and_challenged_scopes(self) -> None:
        self.assertEqual(main.union_scopes({"payments:read"}, {"payments:write"}), frozenset({"payments:read", "payments:write"}))
        self.assertEqual(main.union_scopes(frozenset(), {"a"}), frozenset({"a"}))
        self.assertEqual(main.union_scopes({"a", "b"}, {"b", "c"}), frozenset({"a", "b", "c"}))

    def test_step_up_flow_reaches_the_tool_once_scope_is_granted(self) -> None:
        response, granted = self.client.call_with_step_up(
            "send_payment", {"payee": "acme", "amountUsd": 40},
            scopes=frozenset({"payments:read"}),
            authorize=lambda requested: requested,
        )
        self.assertEqual(granted, frozenset({"payments:read", "payments:write"}))
        self.assertEqual(response["result"]["resultType"], "input_required")

    def test_step_up_retry_cap_is_enforced(self) -> None:
        stubborn = lambda requested: frozenset({"payments:read"})
        with self.assertRaises(PermissionError):
            self.client.call_with_step_up(
                "send_payment", {"payee": "mallory", "amountUsd": 999},
                scopes=frozenset({"payments:read"}), authorize=stubborn,
            )

    def test_tools_list_is_filtered_by_granted_scopes(self) -> None:
        limited = [tool["name"] for tool in self.client.list_tools(scopes=frozenset({"payments:read"}))]
        full = [tool["name"] for tool in self.client.list_tools(scopes=frozenset({"payments:read", "payments:write"}))]
        self.assertNotIn("send_payment", limited)
        self.assertIn("send_payment", full)
        self.assertIn("list_files", limited)
        self.assertIn("delete_file", limited)

    def test_every_request_carries_protocol_version_and_capabilities(self) -> None:
        scenario = main.run_scenario()
        requests = [message for message in scenario["client"].log if isinstance(message, dict) and "method" in message]
        self.assertTrue(requests)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIn("elicitation", meta[main.CAPS_KEY])

    def test_every_result_carries_a_result_type(self) -> None:
        for message in main.transcript():
            entry = message.get("message") if isinstance(message, dict) and "message" in message and "jsonrpc" not in message else message
            if isinstance(entry, dict) and "result" in entry:
                self.assertIn(entry["result"]["resultType"], {"complete", "input_required"})

    def test_input_required_results_carry_no_caching_hints(self) -> None:
        response = self.client.call("delete_file", {"path": "notes.txt"})
        self.assertNotIn("ttlMs", response["result"])
        self.assertNotIn("cacheScope", response["result"])

    def test_mrtr_retry_uses_a_new_id_and_echoes_request_state_exactly(self) -> None:
        prompt = self.client.call("delete_file", {"path": "notes.txt"})
        prompt_id = self.client.log[-2]["id"]
        state = prompt["result"]["requestState"]
        self.client.call(
            "delete_file", {"path": "notes.txt"},
            input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
            request_state=state,
        )
        retry_id = self.client.log[-2]["id"]
        retry_request_state = self.client.log[-2]["params"]["requestState"]
        self.assertNotEqual(retry_id, prompt_id)
        self.assertEqual(retry_request_state, state)


if __name__ == "__main__":
    unittest.main()
