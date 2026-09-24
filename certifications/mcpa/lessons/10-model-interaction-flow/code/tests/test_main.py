import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


def pair_requests_with_results(transcript):
    pairs = {}
    pending = None
    for message in transcript:
        if "method" in message:
            pending = message
        else:
            pairs[message["id"]] = (pending, message)
    return pairs


class ModelInteractionFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.result = main.run_session()
        self.pairs = pair_requests_with_results(self.result.transcript)

    def test_tool_definitions_enter_context_in_deterministic_order(self) -> None:
        server, _ = main.build_server()
        client = main.Client(server)
        first = [tool["name"] for tool in client.list_tools()]
        second = [tool["name"] for tool in client.list_tools()]
        self.assertEqual(first, second)
        self.assertEqual(first, sorted(first))

    def test_every_request_carries_protocol_version_and_capabilities(self) -> None:
        requests = [message for message in self.result.transcript if "method" in message]
        self.assertTrue(requests)
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_request_without_meta_is_rejected_with_invalid_params(self) -> None:
        server, _ = main.build_server()
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_missing_annotations_default_to_destructive_and_require_confirmation(self) -> None:
        self.assertTrue(main.requires_confirmation({}))
        self.assertFalse(main.requires_confirmation({"readOnlyHint": True}))
        self.assertFalse(main.requires_confirmation({"readOnlyHint": False, "destructiveHint": False}))

    def test_confirmation_gate_blocks_a_destructive_call_when_denied(self) -> None:
        close_calls = [
            request for request, _ in self.pairs.values()
            if request is not None and request["params"].get("name") == "close_ticket"
        ]
        closed_ids = [call["params"]["arguments"]["ticket_id"] for call in close_calls]
        self.assertEqual(closed_ids, ["TCK-1"])
        self.assertEqual(self.result.closed, ["TCK-1"])
        self.assertEqual(self.result.denied, ["TCK-2"])

    def test_tool_execution_error_is_fed_back_and_the_corrected_call_succeeds(self) -> None:
        forecast_calls = [
            (request, result) for request, result in self.pairs.values()
            if request is not None and request["params"].get("name") == "get_forecast"
        ]
        self.assertEqual(len(forecast_calls), 2)
        first_request, first_result = forecast_calls[0]
        second_request, second_result = forecast_calls[1]
        self.assertEqual(first_request["params"]["arguments"], {})
        self.assertTrue(first_result["result"]["isError"])
        self.assertNotEqual(first_request["id"], second_request["id"])
        self.assertEqual(second_request["params"]["arguments"]["city"], "Pune")
        self.assertFalse(second_result["result"]["isError"])
        self.assertIn("Pune", second_result["result"]["content"][0]["text"])

    def test_input_required_result_interrupts_the_loop_until_answered(self) -> None:
        open_calls = [
            (request, result) for request, result in self.pairs.values()
            if request is not None and request["params"].get("name") == "open_ticket"
        ]
        self.assertEqual(len(open_calls), 2)
        first_request, first_result = open_calls[0]
        second_request, second_result = open_calls[1]
        self.assertNotIn("inputResponses", first_request["params"])
        self.assertEqual(first_result["result"]["resultType"], "input_required")
        self.assertIn("priority", first_result["result"]["inputRequests"])
        self.assertIn("inputResponses", second_request["params"])
        self.assertEqual(second_result["result"]["resultType"], "complete")
        self.assertEqual(second_result["result"]["structuredContent"]["priority"], "high")

    def test_mrtr_retry_uses_a_new_id_and_echoes_request_state_exactly(self) -> None:
        open_calls = [
            (request, result) for request, result in self.pairs.values()
            if request is not None and request["params"].get("name") == "open_ticket"
        ]
        first_request, first_result = open_calls[0]
        second_request, _ = open_calls[1]
        self.assertNotEqual(first_request["id"], second_request["id"])
        self.assertEqual(second_request["params"]["requestState"], first_result["result"]["requestState"])

    def test_protocol_error_is_not_retried_blindly(self) -> None:
        archive_calls = [
            (request, result) for request, result in self.pairs.values()
            if request is not None and request["params"].get("name") == "archive_ticket"
        ]
        self.assertEqual(len(archive_calls), 1)
        _, error_response = archive_calls[0]
        self.assertIn("error", error_response)
        self.assertEqual(error_response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(self.result.unsupported, ["archive_ticket"])

    def test_final_answer_includes_result_content(self) -> None:
        self.assertIn("Pune", self.result.final_answer)
        self.assertIn("TCK-3", self.result.final_answer)
        self.assertIn("Closed TCK-1", self.result.final_answer)


if __name__ == "__main__":
    unittest.main()
