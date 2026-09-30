import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


def new_pair() -> tuple[main.LifecycleServer, main.Client]:
    server = main.LifecycleServer()
    return server, main.Client(server)


class ToolInvocationLifecycleTests(unittest.TestCase):
    def test_happy_path_stages_are_in_order(self) -> None:
        server, client = new_pair()
        run = main.run_happy_path(server, client)
        self.assertEqual(
            run.stages,
            [main.STAGE_DISCOVER, main.STAGE_LIST, main.STAGE_SELECT, main.STAGE_CONFIRM, main.STAGE_CALL,
             main.STAGE_VALIDATE, main.STAGE_EXECUTE, main.STAGE_PROGRESS, main.STAGE_RESULT, main.STAGE_FINAL],
        )
        self.assertEqual(run.final, "complete")

    def test_input_required_stage_then_retry_completes(self) -> None:
        server, client = new_pair()
        run = main.run_needs_input_then_retry(server, client)
        self.assertIn(main.STAGE_RETRY, run.stages)
        retry_index = run.stages.index(main.STAGE_RETRY)
        self.assertEqual(run.stages[retry_index + 1], main.STAGE_CALL)
        self.assertEqual(run.final, "complete")
        first_call_id, second_call_id = run.request_ids
        self.assertNotEqual(first_call_id, second_call_id, "the retry must use a new JSON-RPC id")

    def test_retry_echoes_request_state_and_delivers_a_published_result(self) -> None:
        server, client = new_pair()
        main.run_needs_input_then_retry(server, client)
        requests = [message for message in client.log if isinstance(message, dict) and message.get("method") == "tools/call"]
        self.assertNotIn("requestState", requests[0]["params"], "the first attempt has no state to echo yet")
        second_state = requests[1]["params"].get("requestState")
        results = [message["result"] for message in client.log if isinstance(message, dict) and "result" in message]
        ask = next(result for result in results if result.get("resultType") == "input_required")
        self.assertEqual(second_state, ask["requestState"])
        published = results[-1]
        self.assertTrue(published.get("structuredContent", {}).get("published"))

    def test_confirmation_denied_stops_before_the_call_stage(self) -> None:
        server, client = new_pair()
        run = main.run_confirmation_denied(server, client)
        self.assertNotIn(main.STAGE_CALL, run.stages)
        self.assertEqual(run.stages[-2:], [main.STAGE_CONFIRM, main.STAGE_FINAL])
        self.assertEqual(run.final, "confirmation_denied")

    def test_unknown_tool_fails_at_validate_stage_with_invalid_params(self) -> None:
        server, client = new_pair()
        run = main.run_unknown_tool(server, client)
        self.assertEqual(run.stages[-2], main.STAGE_VALIDATE)
        self.assertNotIn(main.STAGE_EXECUTE, run.stages)
        self.assertEqual(run.final, "protocol_error")
        errors = [message["error"] for message in client.log if isinstance(message, dict) and "error" in message]
        self.assertEqual(errors[-1]["code"], main.INVALID_PARAMS)

    def test_validation_failure_lands_as_is_error_at_execute_stage(self) -> None:
        server, client = new_pair()
        run = main.run_invalid_arguments(server, client)
        self.assertIn(main.STAGE_EXECUTE, run.stages)
        self.assertIn(main.STAGE_RESULT, run.stages)
        self.assertEqual(run.final, "isError")
        results = [message["result"] for message in client.log if isinstance(message, dict) and "result" in message]
        self.assertTrue(results[-1]["isError"])
        self.assertNotIn("error", client.log[-1])

    def test_broken_stream_is_reissued_with_a_new_id(self) -> None:
        server, client = new_pair()
        run = main.run_broken_stream_reissue(server, client)
        self.assertEqual(len(run.request_ids), 2)
        self.assertNotEqual(run.request_ids[0], run.request_ids[1])
        self.assertEqual(run.final, "complete")
        dropped_entry = next(entry for entry in client.log if isinstance(entry, dict) and entry.get("violation"))
        self.assertEqual(dropped_entry["message"]["id"], run.request_ids[0])

    def test_timeout_cancels_and_stops(self) -> None:
        server, client = new_pair()
        run = main.run_timeout_then_cancel(server, client)
        self.assertEqual(run.final, "cancelled")
        cancellations = [message for message in client.log if isinstance(message, dict) and message.get("method") == "notifications/cancelled"]
        self.assertEqual(len(cancellations), 1)
        self.assertNotIn("id", cancellations[0])
        self.assertEqual(cancellations[0]["params"]["requestId"], run.request_ids[-1])

    def test_late_response_after_cancellation_is_ignored(self) -> None:
        server, client = new_pair()
        run = main.run_timeout_then_cancel(server, client)
        self.assertEqual(run.stages[-1], "late_response_ignored")
        late_texts = [
            message["result"]["content"][0]["text"]
            for message in client.log
            if isinstance(message, dict) and "result" in message and message["result"].get("content")
        ]
        self.assertNotIn("finished after all", late_texts, "a response delivered after cancellation must not reach the log")
        last_id = run.request_ids[-1]
        self.assertIn(last_id, client.cancelled_ids)

    def test_unexpected_server_fault_during_execute_is_a_protocol_error_not_is_error(self) -> None:
        server, client = new_pair()
        run = main.run_internal_fault(server, client)
        self.assertEqual(run.final, "protocol_error")
        self.assertNotIn(main.STAGE_RESULT, run.stages[-3:])
        errors = [message["error"] for message in client.log if isinstance(message, dict) and "error" in message]
        self.assertEqual(errors[-1]["code"], main.INTERNAL_ERROR)

    def test_tool_list_is_deterministically_ordered(self) -> None:
        server, client = new_pair()
        run = main.Run("order-check")
        first = client.list_tools(run)
        second = client.list_tools(run)
        first_names = [tool["name"] for tool in first]
        second_names = [tool["name"] for tool in second]
        self.assertEqual(first_names, second_names)
        self.assertEqual(first_names, sorted(first_names))

    def test_every_request_carries_protocol_version_and_capabilities(self) -> None:
        server, client = new_pair()
        main.run_happy_path(server, client)
        requests = [message for message in client.log if isinstance(message, dict) and "method" in message and "id" in message]
        for request in requests:
            meta = request["params"]["_meta"]
            self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
            self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_every_result_message_carries_a_known_result_type(self) -> None:
        for scenario in (main.run_happy_path, main.run_needs_input_then_retry, main.run_invalid_arguments):
            server, client = new_pair()
            scenario(server, client)
            for message in client.log:
                if isinstance(message, dict) and "result" in message:
                    self.assertIn(message["result"]["resultType"], {"complete", "input_required"})


if __name__ == "__main__":
    unittest.main()
