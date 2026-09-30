import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class MultiRoundTripElicitationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.DeployServer()
        self.alice = main.Client("user-alice", self.server)

    def test_first_call_returns_input_required_with_requests_and_state(self) -> None:
        response = self.alice.call({"service": "checkout", "environment": "production"})
        result = response["result"]
        self.assertEqual(result["resultType"], "input_required")
        self.assertIn("confirm", result["inputRequests"])
        self.assertEqual(result["inputRequests"]["confirm"]["method"], "elicitation/create")
        self.assertIsInstance(result["requestState"], str)

    def test_retry_with_new_id_and_accept_completes(self) -> None:
        ask = self.alice.call({"service": "checkout", "environment": "production"})
        state = ask["result"]["requestState"]
        retry = self.alice.call(
            {"service": "checkout", "environment": "production"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        self.assertNotEqual(retry["id"], ask["id"])
        self.assertEqual(retry["result"]["resultType"], "complete")
        self.assertFalse(retry["result"]["isError"])
        self.assertTrue(retry["result"]["structuredContent"]["deployed"])
        deployed_pairs = [(d["service"], d["environment"]) for d in self.server.deployed]
        self.assertIn(("checkout", "production"), deployed_pairs)

    def test_retry_echoes_requestState_exactly(self) -> None:
        ask = self.alice.call({"service": "checkout", "environment": "production"})
        state = ask["result"]["requestState"]
        self.alice.call(
            {"service": "checkout", "environment": "production"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        sent_request = self.alice.log[-2]
        self.assertEqual(sent_request["params"]["requestState"], state)

    def test_decline_yields_non_destructive_result(self) -> None:
        ask = self.alice.call({"service": "billing", "environment": "production"})
        state = ask["result"]["requestState"]
        retry = self.alice.call(
            {"service": "billing", "environment": "production"},
            input_responses={"confirm": {"action": "decline"}},
            request_state=state,
        )
        self.assertEqual(retry["result"]["resultType"], "complete")
        self.assertFalse(retry["result"]["isError"])
        self.assertFalse(retry["result"]["structuredContent"]["deployed"])
        self.assertEqual(self.server.deployed, [])

    def test_tampered_requestState_is_rejected(self) -> None:
        ask = self.alice.call({"service": "search", "environment": "production"})
        state = ask["result"]["requestState"]
        tampered = state[:-1] + ("0" if state[-1] != "0" else "1")
        retry = self.alice.call(
            {"service": "search", "environment": "production"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=tampered,
        )
        self.assertTrue(retry["result"]["isError"])
        self.assertEqual(self.server.deployed, [])

    def test_non_ascii_requestState_is_rejected_as_malformed(self) -> None:
        verdict = main.verify_request_state(b"key", "été.signature", "user-alice", "deploy_release", {}, 0, set())
        self.assertFalse(verdict.ok)
        self.assertIn("malformed", verdict.reason)

    def test_expired_requestState_is_rejected(self) -> None:
        ask = self.alice.call({"service": "search", "environment": "staging"})
        state = ask["result"]["requestState"]
        self.server.clock.advance(main.STATE_TTL_TICKS + 1)
        retry = self.alice.call(
            {"service": "search", "environment": "staging"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        self.assertTrue(retry["result"]["isError"])
        self.assertIn("expired", retry["result"]["content"][0]["text"])

    def test_requestState_from_another_principal_is_rejected(self) -> None:
        mallory = main.Client("user-mallory", self.server)
        ask = self.alice.call({"service": "payments", "environment": "production"})
        state = ask["result"]["requestState"]
        retry = mallory.call(
            {"service": "payments", "environment": "production"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        self.assertTrue(retry["result"]["isError"])
        self.assertEqual(self.server.deployed, [])

    def test_requestState_retargeted_to_different_arguments_is_rejected(self) -> None:
        ask = self.alice.call({"service": "search", "environment": "canary"})
        state = ask["result"]["requestState"]
        retry = self.alice.call(
            {"service": "search", "environment": "production"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        self.assertTrue(retry["result"]["isError"])
        self.assertEqual(self.server.deployed, [])

    def test_requestState_is_single_use(self) -> None:
        ask = self.alice.call({"service": "checkout", "environment": "canary"})
        state = ask["result"]["requestState"]
        first = self.alice.call(
            {"service": "checkout", "environment": "canary"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        second = self.alice.call(
            {"service": "checkout", "environment": "canary"},
            input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}},
            request_state=state,
        )
        self.assertFalse(first["result"]["isError"])
        self.assertTrue(second["result"]["isError"])

    def test_client_without_elicitation_capability_never_receives_elicitation_create(self) -> None:
        guest = main.Client("user-guest", self.server, capabilities={})
        response = guest.call({"service": "checkout", "environment": "staging"})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("elicitation", response["error"]["data"]["requiredCapabilities"])

    def test_missing_required_argument_is_a_tool_execution_error(self) -> None:
        response = self.alice.call({"service": "checkout"})
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])


if __name__ == "__main__":
    unittest.main()
