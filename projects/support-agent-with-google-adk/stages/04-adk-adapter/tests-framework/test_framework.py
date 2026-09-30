import unittest
from adk_adapter import run_adk


class FrameworkTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_agents_emit_both_authors(self):
        result = await run_adk("invoice question")
        self.assertEqual(
            [event["agent"] for event in result["events"]], ["triage", "specialist"]
        )

    async def test_route_state_reaches_session(self):
        self.assertEqual((await run_adk("invoice"))["state"]["route"], "billing")

    async def test_response_state_is_recorded(self):
        self.assertEqual(
            (await run_adk("invoice", answer_reply="Check invoice 12."))["state"][
                "response"
            ],
            "Check invoice 12.",
        )

    async def test_injected_route_is_observable(self):
        result = await run_adk("login", route_reply="access")
        self.assertEqual(result["state"]["route"], "access")
        self.assertIn("Use the route access", result["handoff_prompt"])

    async def test_runs_do_not_share_session_state(self):
        first = await run_adk("invoice", answer_reply="first")
        second = await run_adk("invoice", answer_reply="second")
        self.assertEqual(first["state"]["response"], "first")
        self.assertEqual(second["state"]["response"], "second")


class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_raw_email_and_api_key_never_reach_model(self):
        result = await run_adk(
            "invoice for person@example.invalid api_key=EXAMPLE_PRIVATE_VALUE"
        )
        serialized = str(result)
        self.assertNotIn("person@example.invalid", serialized)
        self.assertNotIn("EXAMPLE_PRIVATE_VALUE", serialized)
        self.assertIn("[redacted]", str(result["model_requests"]))

    async def test_ambiguous_ticket_escalates_before_model(self):
        result = await run_adk("refund password", route_reply="billing")
        self.assertEqual(result["session"]["state"], "escalated")
        self.assertEqual(result["events"], [])
        self.assertEqual(result["model_requests"], [])

    async def test_wrong_capability_is_rejected(self):
        with self.assertRaises(PermissionError):
            await run_adk("invoice", requested_tool="read_account")

    async def test_model_cannot_replace_authorized_route(self):
        with self.assertRaises(ValueError):
            await run_adk("invoice", route_reply="access")

    async def test_response_and_handoff_survive_framework_execution(self):
        result = await run_adk("login problem")
        self.assertEqual(result["session"]["state"], "answered")
        self.assertEqual(result["session"]["response"], result["state"]["response"])
        self.assertEqual(result["tool"], "read_account")
        self.assertEqual(
            [x["event"] for x in result["session"]["history"]], ["classify", "respond"]
        )
