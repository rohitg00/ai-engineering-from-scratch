"""Tests for the lesson 08 Messages lifecycle simulator."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import (
    AccessNeeds,
    MessageLifecycle,
    ProtocolError,
    ScriptedTransport,
    asset_boundary_ledger,
    batch,
    choose_access_pattern,
    collect_stream_text,
    demo,
    multimodal_lab_fixture,
    stable_cache_key,
    validate_multimodal_request,
)


class MessageLifecycleTests(unittest.TestCase):
    def test_shipped_transcript_matches_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "messages-lifecycle-transcript.json"
        expected = json.loads(artifact.read_text(encoding="utf-8"))
        result = demo()
        self.assertEqual({"text": result.text, "turns": result.turns, "messages": result.messages}, expected)

    def test_end_turn_returns_text(self):
        transport = ScriptedTransport([{"stop_reason": "end_turn", "content": [{"type": "text", "text": "done"}]}])
        result = MessageLifecycle(transport).run("start")
        self.assertEqual(result.text, "done")
        self.assertEqual(result.turns, 1)

    def test_tool_use_is_appended_before_matching_result(self):
        transport = ScriptedTransport([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "u1", "name": "add", "input": {"a": 2, "b": 3}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "5"}]},
        ])
        result = MessageLifecycle(transport, {"add": lambda x: x["a"] + x["b"]}).run("add")
        self.assertEqual(result.messages[1]["role"], "assistant")
        self.assertEqual(result.messages[2]["content"][0]["tool_use_id"], "u1")
        self.assertEqual(len(transport.requests[1]), 3)

    def test_unknown_tool_becomes_error_result(self):
        transport = ScriptedTransport([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "u2", "name": "missing", "input": {}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "recovered"}]},
        ])
        result = MessageLifecycle(transport).run("try")
        self.assertTrue(result.messages[2]["content"][0]["is_error"])

    def test_unsupported_stop_reason_fails_closed(self):
        transport = ScriptedTransport([{"stop_reason": "mystery", "content": [{"type": "text", "text": "x"}]}])
        with self.assertRaises(ProtocolError):
            MessageLifecycle(transport).run("start")

    def test_max_turns_prevents_runaway_loop(self):
        response = {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "u1", "name": "noop", "input": {}}]}
        with self.assertRaisesRegex(ProtocolError, "maximum turn"):
            MessageLifecycle(ScriptedTransport([response]), {"noop": lambda _: None}, max_turns=1).run("start")

    def test_stream_collector_requires_stop(self):
        events = [
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "hel"}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "lo"}},
            {"type": "message_stop"},
        ]
        self.assertEqual(collect_stream_text(events), "hello")
        with self.assertRaises(ProtocolError):
            collect_stream_text(events[:-1])

    def test_batch_and_cache_helpers_are_deterministic(self):
        self.assertEqual(batch([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
        self.assertEqual(stable_cache_key("model-a", "rules"), stable_cache_key("model-a", "rules"))
        self.assertNotEqual(stable_cache_key("model-a", "rules"), stable_cache_key("model-b", "rules"))

    def test_shipped_multimodal_fixture_matches_builder(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "multimodal-request-fixture.json"
        self.assertEqual(json.loads(artifact.read_text(encoding="utf-8")), multimodal_lab_fixture())

    def test_access_pattern_separates_client_from_delivery(self):
        self.assertEqual(
            choose_access_pattern(AccessNeeds(supported_sdk=False, progressive_output=True)),
            {"client": "raw-rest", "delivery": "streaming"},
        )
        self.assertEqual(
            choose_access_pattern(AccessNeeds(independent_requests=20, can_wait=True)),
            {"client": "sdk", "delivery": "message-batch"},
        )

    def test_batch_cannot_promise_progressive_tokens(self):
        with self.assertRaisesRegex(ValueError, "do not provide progressive"):
            choose_access_pattern(AccessNeeds(progressive_output=True, independent_requests=2, can_wait=True))

    def test_multimodal_fixture_accepts_only_owned_file_ids(self):
        fixture = multimodal_lab_fixture()
        request = fixture["request"]
        self.assertEqual(validate_multimodal_request(request, set(fixture["owned_file_ids"])), [])
        self.assertIn("unowned file_id", " ".join(validate_multimodal_request(request, set())))

    def test_asset_ledger_redacts_payload_and_file_id(self):
        fixture = multimodal_lab_fixture()
        ledger = asset_boundary_ledger(fixture["request"])
        serialized = json.dumps(ledger)
        self.assertNotIn("iVBOR", serialized)
        self.assertNotIn("file_offline_policy_fixture", serialized)
        self.assertEqual([item["boundary"] for item in ledger], ["request-body", "files-workspace"])

    def test_invalid_base64_is_rejected(self):
        fixture = multimodal_lab_fixture()
        request = fixture["request"]
        request["messages"][0]["content"][1]["source"]["data"] = "not base64"
        errors = validate_multimodal_request(request, set(fixture["owned_file_ids"]))
        self.assertIn("invalid base64", " ".join(errors))


if __name__ == "__main__":
    unittest.main()
