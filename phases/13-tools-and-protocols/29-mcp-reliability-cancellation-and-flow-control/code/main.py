"""Phase 13 Lesson 29: MCP reliability, cancellation, and flow control.
Lesson: ../docs/en.md
Cancellation: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation
Transport: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
This deterministic simulator uses only Python's standard library.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import tempfile
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


STDIO = "stdio"
STREAMABLE_HTTP = "streamable_http"
IN_PROGRESS = "in_progress"
COMPLETED = "completed"
CANCELLED = "cancelled"


class ReliabilityError(ValueError):
    """Raised when a reliability invariant is violated."""


@dataclass
class InFlightRequest:
    request_id: int | str
    operation: str
    transport: str
    started_at_ms: int
    idle_timeout_ms: int
    max_timeout_ms: int
    progress_token: int | str | None = None
    last_activity_ms: int = 0
    last_progress: float | None = None
    state: str = IN_PROGRESS
    cancel_reason: str | None = None
    response: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        self.last_activity_ms = self.started_at_ms


class RequestCoordinator:
    """Model request cancellation and completion races without wall-clock sleeps."""

    def __init__(self) -> None:
        self.requests: dict[int | str, InFlightRequest] = {}
        self.events: list[dict[str, Any]] = []

    def start(
        self,
        request_id: int | str,
        operation: str,
        *,
        transport: str,
        started_at_ms: int,
        idle_timeout_ms: int,
        max_timeout_ms: int,
        progress_token: int | str | None = None,
    ) -> InFlightRequest:
        if type(request_id) not in (int, str):
            raise ReliabilityError("request id must be an integer or string")
        if progress_token is not None and type(progress_token) not in (int, str):
            raise ReliabilityError("progress token must be an integer or string")
        if request_id in self.requests:
            raise ReliabilityError("request ids must be unique while tracked")
        if transport not in {STDIO, STREAMABLE_HTTP}:
            raise ReliabilityError("unsupported transport")
        if idle_timeout_ms <= 0 or max_timeout_ms < idle_timeout_ms:
            raise ReliabilityError("timeouts must be positive and maximum must cover idle")
        request = InFlightRequest(
            request_id=request_id,
            operation=operation,
            transport=transport,
            started_at_ms=started_at_ms,
            idle_timeout_ms=idle_timeout_ms,
            max_timeout_ms=max_timeout_ms,
            progress_token=progress_token,
        )
        self.requests[request_id] = request
        return request

    def progress(
        self,
        request_id: int | str,
        value: float,
        *,
        now_ms: int,
        total: float | None = None,
        message: str | None = None,
    ) -> dict[str, Any] | None:
        request = self.requests[request_id]
        if request.state != IN_PROGRESS or request.progress_token is None:
            return None
        if request.last_progress is not None and value <= request.last_progress:
            raise ReliabilityError("progress must increase")
        request.last_progress = value
        request.last_activity_ms = now_ms
        params: dict[str, Any] = {
            "progressToken": request.progress_token,
            "progress": value,
        }
        if total is not None:
            params["total"] = total
        if message is not None:
            params["message"] = message
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/progress",
            "params": params,
        }
        self.events.append(notification)
        return notification

    def timeout_signal(
        self,
        request_id: int | str,
        *,
        now_ms: int,
    ) -> dict[str, Any] | None:
        request = self.requests[request_id]
        if request.state != IN_PROGRESS:
            return None
        hard_due = now_ms - request.started_at_ms >= request.max_timeout_ms
        idle_due = now_ms - request.last_activity_ms >= request.idle_timeout_ms
        if not hard_due and not idle_due:
            return None
        reason = "maximum timeout" if hard_due else "idle timeout"
        return self.client_cancel_signal(request_id, reason=reason)

    def client_cancel_signal(
        self,
        request_id: int | str,
        *,
        reason: str,
    ) -> dict[str, Any]:
        request = self.requests[request_id]
        if request.transport == STDIO:
            return {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": request_id, "reason": reason},
            }
        return {
            "action": "close_response_stream",
            "requestId": request_id,
            "reason": reason,
        }

    def receive_stdio_cancellation(self, notification: dict[str, Any]) -> None:
        """Process the fire-and-forget notification and never return JSON-RPC."""

        if notification.get("method") != "notifications/cancelled":
            return None
        params = notification.get("params")
        if not isinstance(params, dict):
            return None
        request_id = params.get("requestId")
        if type(request_id) not in (int, str):
            return None
        request = self.requests.get(request_id)
        if request is None or request.transport != STDIO or request.state != IN_PROGRESS:
            return None
        request.state = CANCELLED
        reason = params.get("reason")
        request.cancel_reason = reason if isinstance(reason, str) else None
        self.events.append(
            {
                "event": "request_cancelled",
                "requestId": request.request_id,
                "transport": STDIO,
            }
        )
        return None

    def close_http_stream(self, request_id: int | str, *, reason: str) -> None:
        request = self.requests.get(request_id)
        if request is None or request.transport != STREAMABLE_HTTP:
            return None
        if request.state == IN_PROGRESS:
            request.state = CANCELLED
            request.cancel_reason = reason
            self.events.append(
                {
                    "event": "request_cancelled",
                    "requestId": request_id,
                    "transport": STREAMABLE_HTTP,
                }
            )
        return None

    def complete(
        self,
        request_id: int | str,
        result: dict[str, Any],
    ) -> dict[str, Any] | None:
        request = self.requests[request_id]
        if request.state == CANCELLED:
            return None
        if request.state == COMPLETED:
            return request.response
        response = {"jsonrpc": "2.0", "id": request_id, "result": result}
        request.state = COMPLETED
        request.response = response
        self.events.append(response)
        return response

    def server_cancel_subscription(self, request_id: int | str) -> dict[str, Any]:
        request = self.requests.get(request_id)
        if (
            request is None
            or request.transport != STDIO
            or request.operation != "subscriptions/listen"
        ):
            raise ReliabilityError(
                "server-sent notifications/cancelled is reserved for stdio subscriptions/listen"
            )
        if request.state != IN_PROGRESS:
            raise ReliabilityError("subscription request is no longer in progress")
        request.state = CANCELLED
        return {
            "jsonrpc": "2.0",
            "method": "notifications/cancelled",
            "params": {
                "requestId": request_id,
                "reason": "subscription closed by server",
            },
        }


@dataclass(frozen=True)
class RetryDecision:
    classification: str
    reason: str


def classify_retry(
    *,
    side_effect: bool,
    idempotency_key: str | None,
) -> RetryDecision:
    if not side_effect:
        return RetryDecision("safe", "operation is read-only by application contract")
    if idempotency_key:
        return RetryDecision(
            "conditional",
            "retry only with the same idempotency key and identical arguments",
        )
    return RetryDecision(
        "unsafe",
        "a new JSON-RPC id cannot deduplicate a side effect",
    )


class MutationLedger:
    """Commit a simulated mutation and its idempotency record atomically."""

    def __init__(self, database_path: str | Path) -> None:
        self.database_path = str(database_path)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(
            self.database_path,
            isolation_level=None,
            check_same_thread=False,
            timeout=5.0,
        )
        self._connection.execute("PRAGMA busy_timeout = 5000")
        self._connection.execute("PRAGMA journal_mode = WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS mutation_counter (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                executions INTEGER NOT NULL
            )
            """
        )
        self._connection.execute(
            "INSERT OR IGNORE INTO mutation_counter(singleton, executions) VALUES (1, 0)"
        )
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS idempotency_records (
                idempotency_key TEXT PRIMARY KEY,
                fingerprint TEXT NOT NULL,
                result_json TEXT NOT NULL
            )
            """
        )

    def __enter__(self) -> MutationLedger:
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    @property
    def executions(self) -> int:
        with self._lock:
            row = self._connection.execute(
                "SELECT executions FROM mutation_counter WHERE singleton = 1"
            ).fetchone()
        if row is None:
            raise ReliabilityError("mutation counter is missing")
        return int(row[0])

    @staticmethod
    def _fingerprint(account: str, cents: int) -> str:
        payload = json.dumps(
            {"account": account, "cents": cents},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def charge(
        self,
        account: str,
        cents: int,
        *,
        rpc_id: int | str,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        if cents <= 0:
            raise ReliabilityError("charge must be positive")
        fingerprint = self._fingerprint(account, cents)
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                if idempotency_key is not None:
                    stored = self._connection.execute(
                        """
                        SELECT fingerprint, result_json
                        FROM idempotency_records
                        WHERE idempotency_key = ?
                        """,
                        (idempotency_key,),
                    ).fetchone()
                    if stored is not None:
                        stored_fingerprint, stored_json = stored
                        if stored_fingerprint != fingerprint:
                            raise ReliabilityError(
                                "idempotency key was reused with different arguments"
                            )
                        self._connection.execute("COMMIT")
                        return json.loads(stored_json)

                row = self._connection.execute(
                    "SELECT executions FROM mutation_counter WHERE singleton = 1"
                ).fetchone()
                if row is None:
                    raise ReliabilityError("mutation counter is missing")
                execution_number = int(row[0]) + 1
                result = {
                    "receipt": f"charge-{execution_number:03d}",
                    "rpcId": rpc_id,
                    "account": account,
                    "cents": cents,
                }
                result_json = json.dumps(
                    result,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                self._connection.execute(
                    "UPDATE mutation_counter SET executions = ? WHERE singleton = 1",
                    (execution_number,),
                )
                if idempotency_key is not None:
                    self._connection.execute(
                        """
                        INSERT INTO idempotency_records(
                            idempotency_key, fingerprint, result_json
                        ) VALUES (?, ?, ?)
                        """,
                        (idempotency_key, fingerprint, result_json),
                    )
                self._connection.execute("COMMIT")
                return json.loads(result_json)
            except BaseException:
                if self._connection.in_transaction:
                    self._connection.execute("ROLLBACK")
                raise


@dataclass
class DurableTask:
    task_id: str
    status: str = "working"
    cancel_requested: bool = False


class DurableTaskService:
    """Keep durable task cancellation separate from in-flight request cancellation."""

    def __init__(self) -> None:
        self.tasks: dict[str, DurableTask] = {}

    def create(self, task_id: str) -> DurableTask:
        task = DurableTask(task_id)
        self.tasks[task_id] = task
        return task

    def cancel(self, task_id: str) -> dict[str, Any]:
        task = self.tasks[task_id]
        if task.status == "working":
            task.cancel_requested = True
        return {"resultType": "complete"}

    def worker_checkpoint(self, task_id: str) -> DurableTask:
        task = self.tasks[task_id]
        if task.status == "working" and task.cancel_requested:
            task.status = "cancelled"
        return task

    def finish(self, task_id: str) -> DurableTask:
        task = self.tasks[task_id]
        if task.status == "working":
            task.status = "completed"
        return task


class BoundedSseBuffer:
    """Bound progress memory while preserving a final response."""

    def __init__(self, capacity: int) -> None:
        if capacity < 2:
            raise ReliabilityError("SSE buffer capacity must be at least two")
        self.capacity = capacity
        self.events: list[dict[str, Any]] = []
        self.dropped_progress = 0
        self.needs_refetch = False

    def _drop_oldest_progress(self) -> bool:
        for index, event in enumerate(self.events):
            if event.get("kind") == "progress":
                del self.events[index]
                self.dropped_progress += 1
                self.needs_refetch = True
                return True
        return False

    def push_progress(self, token: int | str, value: float) -> None:
        if self.events and self.events[-1].get("kind") == "progress":
            if self.events[-1].get("token") == token:
                self.events[-1] = {"kind": "progress", "token": token, "value": value}
                self.dropped_progress += 1
                self.needs_refetch = True
                return
        if len(self.events) >= self.capacity and not self._drop_oldest_progress():
            self.dropped_progress += 1
            self.needs_refetch = True
            return
        self.events.append({"kind": "progress", "token": token, "value": value})

    def push_final(self, response: dict[str, Any]) -> None:
        while len(self.events) >= self.capacity:
            if not self._drop_oldest_progress():
                raise ReliabilityError("buffer cannot discard a final response")
        self.events.append({"kind": "final", "response": response})

    def drain(self) -> list[dict[str, Any]]:
        drained = list(self.events)
        self.events.clear()
        return drained


def sse_response_headers() -> dict[str, str]:
    return {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }


def sse_keepalive() -> str:
    return ":\r\n"


def reconnect_plan(
    previous_subscription_id: int | str,
    affected_resources: list[str],
    *,
    unsafe_mutation_was_in_flight: bool,
) -> dict[str, Any]:
    return {
        "newSubscriptionId": f"{previous_subscription_id}-retry",
        "sendLastEventId": False,
        "refetch": sorted(set(affected_resources)),
        "retryUnsafeMutation": not unsafe_mutation_was_in_flight,
    }


def retry_delay_ms(client_id: str, attempt: int) -> int:
    if attempt < 0:
        raise ReliabilityError("attempt must be non-negative")
    ceiling = min(8_000, 250 * (2**attempt))
    floor = max(1, ceiling // 2)
    digest = hashlib.sha256(f"{client_id}:{attempt}".encode("utf-8")).digest()
    jitter = int.from_bytes(digest[:4], "big") % max(1, ceiling - floor + 1)
    return floor + jitter


def main() -> None:
    coordinator = RequestCoordinator()
    coordinator.start(
        7,
        "tools/call",
        transport=STDIO,
        started_at_ms=0,
        idle_timeout_ms=500,
        max_timeout_ms=2_000,
        progress_token="progress-7",
    )
    coordinator.progress(7, 1, now_ms=100, total=3, message="started")
    signal = coordinator.timeout_signal(7, now_ms=600)
    coordinator.receive_stdio_cancellation(signal)
    cancelled_response = coordinator.complete(7, {"resultType": "complete"})

    coordinator.start(
        8,
        "tools/call",
        transport=STDIO,
        started_at_ms=0,
        idle_timeout_ms=500,
        max_timeout_ms=2_000,
    )
    completed_response = coordinator.complete(8, {"resultType": "complete"})
    late_signal = coordinator.client_cancel_signal(8, reason="late user action")
    coordinator.receive_stdio_cancellation(late_signal)

    with tempfile.TemporaryDirectory() as directory:
        with MutationLedger(Path(directory) / "mutations.sqlite3") as ledger:
            first_charge = ledger.charge(
                "acct-7",
                1200,
                rpc_id=41,
                idempotency_key="checkout-7",
            )
            second_charge = ledger.charge(
                "acct-7",
                1200,
                rpc_id=42,
                idempotency_key="checkout-7",
            )
            mutation_executions = ledger.executions

    buffer = BoundedSseBuffer(3)
    for value in range(6):
        buffer.push_progress("progress-9", value)
    buffer.push_final({"jsonrpc": "2.0", "id": 9, "result": {"resultType": "complete"}})

    tasks = DurableTaskService()
    tasks.create("task-29")
    task_ack = tasks.cancel("task-29")
    before_checkpoint = tasks.tasks["task-29"].status
    after_checkpoint = tasks.worker_checkpoint("task-29").status

    print("cancel before completion returns:", cancelled_response)
    print("complete before cancel keeps response:", completed_response is not None)
    print("idempotent receipts equal:", first_charge["receipt"] == second_charge["receipt"])
    print("mutation executions:", mutation_executions)
    print("buffer size and dropped progress:", len(buffer.events), buffer.dropped_progress)
    print("final response preserved:", any(event["kind"] == "final" for event in buffer.events))
    print("task cancel acknowledgement:", task_ack["resultType"])
    print("task status before and after worker checkpoint:", before_checkpoint, after_checkpoint)


if __name__ == "__main__":
    main()
