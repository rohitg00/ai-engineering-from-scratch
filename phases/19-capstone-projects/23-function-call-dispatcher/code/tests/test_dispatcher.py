"""function call dispatcher の tests: timeout、retry、idempotency、concurrency。"""

from __future__ import annotations

import asyncio
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    Dispatcher,
    DispatchError,
    DispatchOk,
    MiniRegistry,
    TransientError,
)


def run(coro):
    return asyncio.run(coro)


def _registry_with(name: str, handler, **opts) -> MiniRegistry:
    r = MiniRegistry()
    r.register(name, schema={"type": "object", "properties": {}}, handler=handler, **opts)
    return r


class TestSchemaPath(unittest.TestCase):
    def test_unknown_tool(self) -> None:
        r = MiniRegistry()
        d = Dispatcher(r)
        out = run(d.dispatch("absent", {}))
        self.assertIsInstance(out, DispatchError)
        self.assertEqual(out.kind, "not_found")
        self.assertEqual(out.jsonrpc_code, -32601)

    def test_schema_failure_returns_invalid_params(self) -> None:
        r = MiniRegistry()
        r.register(
            "tool",
            schema={"type": "object", "required": ["id"], "properties": {"id": {"type": "integer"}}},
            handler=lambda id: id,
        )
        d = Dispatcher(r)
        out = run(d.dispatch("tool", {}))
        self.assertIsInstance(out, DispatchError)
        self.assertEqual(out.kind, "schema")
        self.assertEqual(out.jsonrpc_code, -32602)
        out2 = run(d.dispatch("tool", {"id": "nope"}))
        self.assertEqual(out2.kind, "schema")

    def test_schema_error_does_not_retry(self) -> None:
        calls = []

        def h(id):
            calls.append(id)
            return id
        r = MiniRegistry()
        r.register("tool",
                   schema={"type": "object", "required": ["id"], "properties": {"id": {"type": "integer"}}},
                   handler=h)
        d = Dispatcher(r)
        run(d.dispatch("tool", {"id": "x"}))
        self.assertEqual(calls, [])


class TestTimeout(unittest.TestCase):
    def test_timeout_idempotent_retries(self) -> None:
        attempts = {"n": 0}

        async def slow():
            attempts["n"] += 1
            await asyncio.sleep(0.05)
            return "done"

        r = _registry_with("t", slow, idempotent=True, timeout_ms=5)

        async def fake_sleep(_):
            return None

        d = Dispatcher(r, max_attempts=3, sleep=fake_sleep)
        out = run(d.dispatch("t", {}))
        self.assertIsInstance(out, DispatchError)
        self.assertEqual(out.kind, "timeout")
        self.assertEqual(out.attempts, 3)
        self.assertEqual(attempts["n"], 3)

    def test_timeout_non_idempotent_no_retry(self) -> None:
        attempts = {"n": 0}

        async def slow():
            attempts["n"] += 1
            await asyncio.sleep(0.05)
            return "done"

        r = _registry_with("t", slow, idempotent=False, timeout_ms=5)
        d = Dispatcher(r, max_attempts=3)
        out = run(d.dispatch("t", {}))
        self.assertEqual(out.kind, "timeout")
        self.assertEqual(attempts["n"], 1)


class TestRetry(unittest.TestCase):
    def test_transient_retries_until_success(self) -> None:
        attempts = {"n": 0}

        async def flaky():
            attempts["n"] += 1
            if attempts["n"] < 2:
                raise TransientError("準備ができていません")
            return "ok"

        r = _registry_with("t", flaky, idempotent=True, timeout_ms=200)

        async def fake_sleep(_):
            return None

        d = Dispatcher(r, max_attempts=3, sleep=fake_sleep)
        out = run(d.dispatch("t", {}))
        self.assertIsInstance(out, DispatchOk)
        self.assertEqual(out.attempts, 2)

    def test_transient_exhausts_attempts(self) -> None:
        async def always_bad():
            raise TransientError("nope")

        r = _registry_with("t", always_bad, idempotent=True, timeout_ms=200)

        async def fake_sleep(_):
            return None

        d = Dispatcher(r, max_attempts=2, sleep=fake_sleep)
        out = run(d.dispatch("t", {}))
        self.assertIsInstance(out, DispatchError)
        self.assertEqual(out.kind, "transient")
        self.assertEqual(out.attempts, 2)

    def test_random_exception_no_retry(self) -> None:
        attempts = {"n": 0}

        async def bad():
            attempts["n"] += 1
            raise RuntimeError("意図的な失敗")

        r = _registry_with("t", bad, idempotent=True, timeout_ms=200)
        d = Dispatcher(r, max_attempts=3)
        out = run(d.dispatch("t", {}))
        self.assertEqual(out.kind, "internal")
        self.assertEqual(attempts["n"], 1)


class TestIdempotency(unittest.TestCase):
    def test_inflight_dedupe(self) -> None:
        counter = {"n": 0}
        ready = asyncio.Event()

        async def slow_once():
            counter["n"] += 1
            await ready.wait()
            return counter["n"]

        r = _registry_with("t", slow_once, idempotent=True, timeout_ms=2000)
        d = Dispatcher(r, max_attempts=1)

        async def go():
            t1 = asyncio.create_task(d.dispatch("t", {}, idempotency_key="k"))
            await asyncio.sleep(0)
            t2 = asyncio.create_task(d.dispatch("t", {}, idempotency_key="k"))
            await asyncio.sleep(0)
            ready.set()
            return await asyncio.gather(t1, t2)

        results = run(go())
        self.assertEqual(counter["n"], 1)
        self.assertTrue(all(isinstance(r, DispatchOk) for r in results))
        self.assertEqual(results[0].result, results[1].result)

    def test_recent_cache_hit(self) -> None:
        counter = {"n": 0}

        async def h():
            counter["n"] += 1
            return counter["n"]

        r = _registry_with("t", h, idempotent=True, timeout_ms=200)
        d = Dispatcher(r, max_attempts=1, cache_ttl_seconds=60.0)

        async def go():
            a = await d.dispatch("t", {}, idempotency_key="k")
            b = await d.dispatch("t", {}, idempotency_key="k")
            return a, b

        a, b = run(go())
        self.assertEqual(counter["n"], 1)
        self.assertEqual(a.result, b.result)


class TestConcurrency(unittest.TestCase):
    def test_semaphore_bounds_inflight(self) -> None:
        active = {"n": 0, "peak": 0}

        async def h():
            active["n"] += 1
            active["peak"] = max(active["peak"], active["n"])
            await asyncio.sleep(0.01)
            active["n"] -= 1
            return 1

        r = _registry_with("t", h, idempotent=True, timeout_ms=500)
        d = Dispatcher(r, max_attempts=1, concurrency=3)

        async def go():
            tasks = [d.dispatch("t", {}) for _ in range(20)]
            await asyncio.gather(*tasks)

        run(go())
        self.assertLessEqual(active["peak"], 3)


class TestBudget(unittest.TestCase):
    def test_zero_budget_fails_fast(self) -> None:
        r = _registry_with("t", lambda: 1)
        d = Dispatcher(r)
        out = run(d.dispatch("t", {}, budget_tool_calls_remaining=0))
        self.assertIsInstance(out, DispatchError)
        self.assertEqual(out.kind, "budget_exceeded")


if __name__ == "__main__":
    unittest.main()
