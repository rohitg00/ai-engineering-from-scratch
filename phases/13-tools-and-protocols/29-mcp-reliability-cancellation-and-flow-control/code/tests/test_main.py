"""Deterministic tests for MCP reliability and flow control."""

from __future__ import annotations

import concurrent.futures
import importlib.util
import sys
import tempfile
import threading
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson29_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class ReliabilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.coordinator = main.RequestCoordinator()
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)

    def ledger_path(self, name: str = "mutations.sqlite3") -> Path:
        return Path(self.temporary_directory.name) / name

    def start(
        self,
        request_id: int,
        *,
        transport: str = main.STDIO,
        progress_token: str | None = None,
    ) -> main.InFlightRequest:
        return self.coordinator.start(
            request_id,
            "tools/call",
            transport=transport,
            started_at_ms=0,
            idle_timeout_ms=500,
            max_timeout_ms=2_000,
            progress_token=progress_token,
        )

    def test_stdio_cancellation_is_notification_and_suppresses_response(self) -> None:
        request = self.start(1)
        signal = self.coordinator.client_cancel_signal(1, reason="user cancelled")
        self.assertEqual(signal["method"], "notifications/cancelled")
        self.assertEqual(signal["params"]["requestId"], 1)
        self.assertIsNone(self.coordinator.receive_stdio_cancellation(signal))
        self.assertEqual(request.state, main.CANCELLED)
        self.assertIsNone(
            self.coordinator.complete(1, {"resultType": "complete", "value": 1})
        )

    def test_http_cancellation_closes_stream_without_notification(self) -> None:
        request = self.start(2, transport=main.STREAMABLE_HTTP)
        signal = self.coordinator.client_cancel_signal(2, reason="deadline")
        self.assertEqual(signal["action"], "close_response_stream")
        self.assertNotIn("method", signal)
        self.coordinator.close_http_stream(2, reason="deadline")
        self.assertEqual(request.state, main.CANCELLED)
        self.assertIsNone(self.coordinator.complete(2, {"resultType": "complete"}))

    def test_completion_wins_race_and_late_cancellation_is_ignored(self) -> None:
        request = self.start(3)
        response = self.coordinator.complete(3, {"resultType": "complete"})
        self.coordinator.receive_stdio_cancellation(
            self.coordinator.client_cancel_signal(3, reason="too late")
        )
        self.assertEqual(request.state, main.COMPLETED)
        self.assertEqual(response["id"], 3)

    def test_unknown_and_malformed_cancellation_are_ignored(self) -> None:
        self.start(4)
        self.assertIsNone(
            self.coordinator.receive_stdio_cancellation(
                {
                    "jsonrpc": "2.0",
                    "method": "notifications/cancelled",
                    "params": {"requestId": "unknown"},
                }
            )
        )
        self.assertIsNone(
            self.coordinator.receive_stdio_cancellation(
                {"jsonrpc": "2.0", "method": "notifications/cancelled"}
            )
        )
        self.assertEqual(self.coordinator.requests[4].state, main.IN_PROGRESS)

    def test_unhashable_and_boolean_cancellation_ids_are_ignored(self) -> None:
        request = self.start(1)
        for request_id in ([], {}, True):
            with self.subTest(request_id=request_id):
                notification = {
                    "jsonrpc": "2.0",
                    "method": "notifications/cancelled",
                    "params": {"requestId": request_id},
                }
                self.assertIsNone(
                    self.coordinator.receive_stdio_cancellation(notification)
                )
                self.assertEqual(request.state, main.IN_PROGRESS)

    def test_start_rejects_noncanonical_request_ids_before_lookup(self) -> None:
        class DerivedInt(int):
            pass

        for request_id in (True, [], {}, 1.5, None, DerivedInt(7)):
            with self.subTest(request_id=request_id):
                with self.assertRaisesRegex(
                    main.ReliabilityError,
                    "request id must be an integer or string",
                ):
                    self.coordinator.start(
                        request_id,
                        "tools/call",
                        transport=main.STDIO,
                        started_at_ms=0,
                        idle_timeout_ms=500,
                        max_timeout_ms=2_000,
                    )
        self.assertEqual(self.coordinator.requests, {})

    def test_start_rejects_noncanonical_progress_tokens(self) -> None:
        for index, progress_token in enumerate((True, [], {}, 1.5), start=1):
            with self.subTest(progress_token=progress_token):
                with self.assertRaisesRegex(
                    main.ReliabilityError,
                    "progress token must be an integer or string",
                ):
                    self.coordinator.start(
                        index,
                        "tools/call",
                        transport=main.STDIO,
                        started_at_ms=0,
                        idle_timeout_ms=500,
                        max_timeout_ms=2_000,
                        progress_token=progress_token,
                    )
        self.assertEqual(self.coordinator.requests, {})

    def test_progress_resets_idle_timeout_but_not_maximum_timeout(self) -> None:
        self.start(5, progress_token="p-5")
        self.coordinator.progress(5, 1, now_ms=400)
        self.coordinator.progress(5, 2, now_ms=800)
        self.coordinator.progress(5, 3, now_ms=1_200)
        self.assertIsNone(self.coordinator.timeout_signal(5, now_ms=1_500))
        signal = self.coordinator.timeout_signal(5, now_ms=2_000)
        self.assertEqual(signal["params"]["reason"], "maximum timeout")

    def test_idle_timeout_cancels_when_progress_stops(self) -> None:
        self.start(6, progress_token="p-6")
        self.coordinator.progress(6, 1, now_ms=100)
        signal = self.coordinator.timeout_signal(6, now_ms=600)
        self.assertEqual(signal["params"]["reason"], "idle timeout")

    def test_progress_must_increase_and_stops_after_completion(self) -> None:
        self.start(7, progress_token="p-7")
        self.coordinator.progress(7, 1, now_ms=10)
        with self.assertRaises(main.ReliabilityError):
            self.coordinator.progress(7, 1, now_ms=20)
        self.coordinator.complete(7, {"resultType": "complete"})
        self.assertIsNone(self.coordinator.progress(7, 2, now_ms=30))

    def test_new_json_rpc_id_does_not_deduplicate_mutation(self) -> None:
        with main.MutationLedger(self.ledger_path()) as ledger:
            first = ledger.charge("acct", 500, rpc_id=1)
            second = ledger.charge("acct", 500, rpc_id=2)
            self.assertNotEqual(first["receipt"], second["receipt"])
            self.assertEqual(ledger.executions, 2)

    def test_idempotency_key_deduplicates_identical_arguments(self) -> None:
        with main.MutationLedger(self.ledger_path()) as ledger:
            first = ledger.charge("acct", 500, rpc_id=1, idempotency_key="order-9")
            second = ledger.charge("acct", 500, rpc_id=2, idempotency_key="order-9")
            self.assertEqual(first, second)
            self.assertIsNot(first, second)
            self.assertEqual(ledger.executions, 1)
            with self.assertRaises(main.ReliabilityError):
                ledger.charge("acct", 700, rpc_id=3, idempotency_key="order-9")

    def test_concurrent_same_key_commits_one_mutation(self) -> None:
        path = self.ledger_path()
        first_ledger = main.MutationLedger(path)
        second_ledger = main.MutationLedger(path)
        barrier = threading.Barrier(2)

        def charge(ledger: main.MutationLedger, rpc_id: int) -> dict:
            barrier.wait()
            return ledger.charge(
                "acct",
                500,
                rpc_id=rpc_id,
                idempotency_key="order-concurrent",
            )

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                futures = [
                    executor.submit(charge, first_ledger, 1),
                    executor.submit(charge, second_ledger, 2),
                ]
                results = [future.result(timeout=5) for future in futures]
            self.assertEqual(results[0], results[1])
            self.assertIsNot(results[0], results[1])
            self.assertEqual(first_ledger.executions, 1)
        finally:
            first_ledger.close()
            second_ledger.close()

    def test_mutating_returned_result_does_not_change_stored_result(self) -> None:
        with main.MutationLedger(self.ledger_path()) as ledger:
            first = ledger.charge(
                "acct",
                500,
                rpc_id=1,
                idempotency_key="order-copy",
            )
            first["account"] = "tampered"
            first["receipt"] = "tampered"
            replay = ledger.charge(
                "acct",
                500,
                rpc_id=2,
                idempotency_key="order-copy",
            )
            self.assertEqual(replay["account"], "acct")
            self.assertEqual(replay["receipt"], "charge-001")
            self.assertEqual(ledger.executions, 1)

    def test_committed_record_survives_ledger_reopen(self) -> None:
        path = self.ledger_path()
        with main.MutationLedger(path) as first_ledger:
            original = first_ledger.charge(
                "acct",
                500,
                rpc_id=1,
                idempotency_key="order-reopen",
            )
        with main.MutationLedger(path) as reopened_ledger:
            replay = reopened_ledger.charge(
                "acct",
                500,
                rpc_id=2,
                idempotency_key="order-reopen",
            )
            self.assertEqual(replay, original)
            self.assertEqual(reopened_ledger.executions, 1)

    def test_retry_matrix_distinguishes_safe_conditional_and_unsafe(self) -> None:
        self.assertEqual(
            main.classify_retry(side_effect=False, idempotency_key=None).classification,
            "safe",
        )
        self.assertEqual(
            main.classify_retry(
                side_effect=True,
                idempotency_key="order-1",
            ).classification,
            "conditional",
        )
        self.assertEqual(
            main.classify_retry(side_effect=True, idempotency_key=None).classification,
            "unsafe",
        )

    def test_bounded_buffer_coalesces_progress_and_preserves_final(self) -> None:
        buffer = main.BoundedSseBuffer(3)
        for value in range(20):
            buffer.push_progress("p-8", value)
        final = {"jsonrpc": "2.0", "id": 8, "result": {"resultType": "complete"}}
        buffer.push_final(final)
        self.assertLessEqual(len(buffer.events), 3)
        self.assertGreater(buffer.dropped_progress, 0)
        self.assertTrue(buffer.needs_refetch)
        self.assertEqual(buffer.events[-1], {"kind": "final", "response": final})

    def test_reconnect_refetches_without_last_event_id_or_unsafe_replay(self) -> None:
        plan = main.reconnect_plan(
            "listen-1",
            ["notes://b", "notes://a", "notes://a"],
            unsafe_mutation_was_in_flight=True,
        )
        self.assertEqual(plan["newSubscriptionId"], "listen-1-retry")
        self.assertFalse(plan["sendLastEventId"])
        self.assertFalse(plan["retryUnsafeMutation"])
        self.assertEqual(plan["refetch"], ["notes://a", "notes://b"])

    def test_proxy_headers_and_keepalive_are_explicit(self) -> None:
        headers = main.sse_response_headers()
        self.assertEqual(headers["Content-Type"], "text/event-stream")
        self.assertEqual(headers["X-Accel-Buffering"], "no")
        self.assertEqual(main.sse_keepalive(), ":\r\n")

    def test_retry_backoff_is_bounded_and_spread_by_client(self) -> None:
        delays = {main.retry_delay_ms(client, 4) for client in ["a", "b", "c", "d"]}
        self.assertGreater(len(delays), 1)
        for delay in delays:
            self.assertGreaterEqual(delay, 2_000)
            self.assertLessEqual(delay, 4_000)

    def test_task_cancellation_acknowledgement_is_not_final_status(self) -> None:
        tasks = main.DurableTaskService()
        tasks.create("task-1")
        acknowledgement = tasks.cancel("task-1")
        self.assertEqual(acknowledgement, {"resultType": "complete"})
        self.assertEqual(tasks.tasks["task-1"].status, "working")
        self.assertEqual(tasks.worker_checkpoint("task-1").status, "cancelled")

    def test_server_cancellation_is_reserved_for_stdio_subscription(self) -> None:
        self.coordinator.start(
            "listen-1",
            "subscriptions/listen",
            transport=main.STDIO,
            started_at_ms=0,
            idle_timeout_ms=500,
            max_timeout_ms=2_000,
        )
        notification = self.coordinator.server_cancel_subscription("listen-1")
        self.assertEqual(notification["method"], "notifications/cancelled")
        self.start(9)
        with self.assertRaises(main.ReliabilityError):
            self.coordinator.server_cancel_subscription(9)

    def test_completed_subscription_rejects_late_server_cancellation(self) -> None:
        request = self.coordinator.start(
            "listen-complete",
            "subscriptions/listen",
            transport=main.STDIO,
            started_at_ms=0,
            idle_timeout_ms=500,
            max_timeout_ms=2_000,
        )
        response = self.coordinator.complete(
            "listen-complete", {"resultType": "complete"}
        )

        with self.assertRaisesRegex(main.ReliabilityError, "no longer in progress"):
            self.coordinator.server_cancel_subscription("listen-complete")

        self.assertEqual(request.state, main.COMPLETED)
        self.assertEqual(
            self.coordinator.complete(
                "listen-complete", {"resultType": "complete", "changed": True}
            ),
            response,
        )


if __name__ == "__main__":
    unittest.main()
