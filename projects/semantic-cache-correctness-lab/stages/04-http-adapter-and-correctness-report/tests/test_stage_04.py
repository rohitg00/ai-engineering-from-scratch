"""Unit tests for Stage 4: HTTP Adapter and Correctness Benchmark Report."""

import json
import os
import sys
import tempfile
import unittest

WORKSPACE = os.environ.get("PROJECT_WORKSPACE")
if WORKSPACE and WORKSPACE not in sys.path:
    sys.path.insert(0, WORKSPACE)

try:
    from main import (
        CacheAdapter,
        CacheEntry,
        SemanticCacheStore,
        analyze_threshold_sensitivity,
        export_report,
        run_correctness_benchmark,
    )
except ImportError:
    pass


class TestStage04AdapterAndReport(unittest.TestCase):
    """Test suite verifying HTTP adapter headers, write-through caching, and benchmark metrics."""

    def setUp(self):
        self.store = SemanticCacheStore()
        self.entry = CacheEntry(
            entry_id="e1",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the return policy for defective laptops?",
            response="30-day return policy.",
            created_at=100.0,
            ttl_seconds=3600.0,
            soft_ttl_seconds=300.0,
        )
        self.store.put(self.entry)
        self.adapter = CacheAdapter(self.store)

    def test_adapter_exact_hit_headers(self):
        """Verify HTTP headers on exact cache hit including RFC 9111 Age."""
        req = {
            "tenant_id": "tenant-alpha",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "What is the return policy for defective laptops?",
        }
        res = self.adapter.handle_request(req, current_time=250.0)
        self.assertTrue(res["cached"])
        self.assertEqual(res["headers"]["X-Cache"], "HIT-EXACT")
        self.assertEqual(res["headers"]["X-Cache-Score"], 1.0)
        self.assertEqual(res["headers"]["X-Cache-Latency-Saved-Ms"], 350.0)
        self.assertEqual(res["headers"]["Age"], "150")
        self.assertIn("max-age=3450", res["headers"]["Cache-Control"])
        self.assertEqual(res["response"], "30-day return policy.")

    def test_adapter_semantic_hit_headers(self):
        """Verify HTTP headers on semantic cache hit."""
        req = {
            "tenant_id": "tenant-alpha",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "What is the return policy regarding defective laptops?",
        }
        res = self.adapter.handle_request(req, threshold=0.75, current_time=100.0)
        self.assertTrue(res["cached"])
        self.assertEqual(res["headers"]["X-Cache"], "HIT-SEMANTIC")
        self.assertGreaterEqual(res["headers"]["X-Cache-Score"], 0.75)
        self.assertEqual(res["headers"]["X-Cache-Latency-Saved-Ms"], 350.0)

    def test_adapter_miss_and_writethrough(self):
        """Verify cache miss invokes upstream handler and populates cache on write-through."""
        req = {
            "tenant_id": "tenant-alpha",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "How do I reset my password?",
        }
        called = []

        def mock_upstream(p):
            called.append(p)
            return "Click 'Forgot Password' link."

        res1 = self.adapter.handle_request(req, upstream_handler=mock_upstream, current_time=100.0)
        self.assertFalse(res1["cached"])
        self.assertEqual(res1["headers"]["X-Cache"], "MISS")
        self.assertEqual(res1["response"], "Click 'Forgot Password' link.")
        self.assertEqual(len(called), 1)

        # Subsequent query should now hit the cache!
        res2 = self.adapter.handle_request(req, upstream_handler=mock_upstream, current_time=100.0)
        self.assertTrue(res2["cached"])
        self.assertEqual(res2["headers"]["X-Cache"], "HIT-EXACT")
        self.assertEqual(len(called), 1)

    def test_adapter_adversarial_miss_reason(self):
        """Verify adversarial near-miss records reason in headers."""
        req = {
            "tenant_id": "tenant-alpha",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "What is the return policy for 500 defective laptops?",
        }
        res = self.adapter.handle_request(req, threshold=0.75, current_time=100.0)
        self.assertFalse(res["cached"])
        self.assertEqual(res["headers"]["X-Cache"], "MISS")
        self.assertIn("adversarial_blocked", res["headers"]["X-Cache-Miss-Reason"])

    def test_run_correctness_benchmark(self):
        """Verify benchmark metrics calculation across queries."""
        dataset = [
            {
                "name": "exact_match",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy for defective laptops?",
                "expected_outcome": "HIT-EXACT",
            },
            {
                "name": "paraphrase",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy regarding defective laptops?",
                "expected_outcome": "HIT-SEMANTIC",
            },
            {
                "name": "adversarial_number",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy for 500 defective laptops?",
                "expected_outcome": "MISS",
            },
            {
                "name": "cross_tenant",
                "category": "cross_tenant",
                "tenant_id": "tenant-other",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy for defective laptops?",
                "expected_outcome": "MISS",
            },
        ]
        results = run_correctness_benchmark(dataset, store=self.store, threshold=0.75, current_time=100.0)
        self.assertEqual(results["total_queries"], 4)
        self.assertEqual(results["exact_hits"], 1)
        self.assertEqual(results["semantic_hits"], 1)
        self.assertEqual(results["safe_misses"], 2)
        self.assertEqual(results["false_hits"], 0)
        self.assertEqual(results["accuracy_pct"], 100.0)
        self.assertTrue(results["compatible"])
        self.assertEqual(results["cross_tenant_blocks"], 1)

    def test_benchmark_strict_gate_rejects_outcome_mismatch(self):
        """Verify compatible is False when any query outcome differs from expected."""
        dataset = [
            {
                "name": "expect_exact_but_miss",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "Uncached question",
                "expected_outcome": "HIT-EXACT",
            }
        ]
        results = run_correctness_benchmark(dataset, store=self.store, threshold=0.75, current_time=100.0)
        self.assertFalse(results["compatible"])

    def test_make_http_handler_class(self):
        """Verify HTTP wire adapter handler class creation."""
        from http.server import BaseHTTPRequestHandler
        from main import make_http_handler_class
        handler_cls = make_http_handler_class(self.adapter)
        self.assertTrue(issubclass(handler_cls, BaseHTTPRequestHandler))

    def test_analyze_threshold_sensitivity(self):
        """Verify sensitivity analysis over varying thresholds."""
        dataset = [
            {
                "name": "exact_match",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy for defective laptops?",
                "expected_outcome": "HIT-EXACT",
            },
            {
                "name": "paraphrase",
                "tenant_id": "tenant-alpha",
                "model": "gpt-4o",
                "source_revision": "v1",
                "prompt": "What is the return policy regarding defective laptops?",
                "expected_outcome": "HIT-SEMANTIC",
            },
        ]
        curve = analyze_threshold_sensitivity(dataset, store=self.store, threshold_range=[0.70, 0.85, 0.95])
        self.assertEqual(len(curve), 3)
        self.assertTrue(all(pt["false_hits"] == 0 for pt in curve))

    def test_export_report_file(self):
        """Verify export_report writes clean JSON."""
        data = {"test": 123, "compatible": True}
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_report(tmp_path, data)
            with open(tmp_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            self.assertEqual(loaded, data)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_soft_expired_revalidates_with_upstream(self):
        """Verify soft-expired answers revalidate via upstream handler rather than staying stale."""
        revalidated = []

        def mock_upstream(prompt):
            revalidated.append(prompt)
            return "Updated 45-day return policy."

        req = {
            "tenant_id": "tenant-alpha",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "What is the return policy for defective laptops?",
        }
        # created_at was 100.0, soft_ttl was 300.0 (soft expires at 400.0). Query at 450.0
        res = self.adapter.handle_request(req, upstream_handler=mock_upstream, current_time=450.0)
        self.assertTrue(res["cached"])
        self.assertEqual(res["headers"]["X-Cache-Revalidated"], "true")
        self.assertEqual(res["response"], "Updated 45-day return policy.")
        self.assertEqual(len(revalidated), 1)

    def test_authorized_tenant_enforcement(self):
        """Verify CacheAdapter rejects requests attempting to query a different tenant."""
        from main import TenantIsolationError
        req = {
            "tenant_id": "tenant-victim",
            "model": "gpt-4o",
            "source_revision": "v1",
            "prompt": "What is my confidential balance?",
        }
        with self.assertRaises(TenantIsolationError):
            self.adapter.handle_request(req, authorized_tenant_id="tenant-attacker")

    def test_http_handler_bounded_limits_and_errors(self):
        """Verify HTTP wire handler class exposes error response helper and handles bounds."""
        from http.server import BaseHTTPRequestHandler
        from main import make_http_handler_class
        handler_cls = make_http_handler_class(self.adapter)
        self.assertTrue(issubclass(handler_cls, BaseHTTPRequestHandler))
        self.assertTrue(hasattr(handler_cls, "send_error_response"))


if __name__ == "__main__":
    unittest.main()
