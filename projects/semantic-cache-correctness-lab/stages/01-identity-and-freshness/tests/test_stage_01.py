"""Unit tests for Stage 1: Identity, Freshness and Tenant Boundaries."""

import math
import os
import sys
import unittest

# Ensure learner workspace or stage directory is in path
WORKSPACE = os.environ.get("PROJECT_WORKSPACE")
if WORKSPACE and WORKSPACE not in sys.path:
    sys.path.insert(0, WORKSPACE)

try:
    from main import (
        CacheEntry,
        compute_exact_key,
        is_fresh,
        validate_cache_request,
    )
except ImportError:
    pass


class TestStage01IdentityAndFreshness(unittest.TestCase):
    """Test suite verifying cache identity, tenant boundaries, and TTL constraints."""

    def test_compute_exact_key_deterministic(self):
        """Verify identical inputs generate identical SHA-256 hashes."""
        key1 = compute_exact_key(
            tenant_id="tenant-1",
            model="claude-3-5-sonnet",
            source_revision="rev-10",
            prompt="Hello world",
        )
        key2 = compute_exact_key(
            tenant_id="tenant-1",
            model="claude-3-5-sonnet",
            source_revision="rev-10",
            prompt="  Hello world  ",
        )
        self.assertEqual(key1, key2)
        self.assertEqual(len(key1), 64)

    def test_compute_exact_key_tenant_isolation(self):
        """Verify different tenants get distinct keys for identical prompts."""
        key_a = compute_exact_key(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is my account balance?",
        )
        key_b = compute_exact_key(
            tenant_id="tenant-beta",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is my account balance?",
        )
        self.assertNotEqual(key_a, key_b)

    def test_compute_exact_key_revision_and_model_isolation(self):
        """Verify changes in model or source revision change the key."""
        base = compute_exact_key("t1", "m1", "v1", "test query")
        diff_rev = compute_exact_key("t1", "m1", "v2", "test query")
        diff_model = compute_exact_key("t1", "m2", "v1", "test query")
        self.assertNotEqual(base, diff_rev)
        self.assertNotEqual(base, diff_model)

    def test_compute_exact_key_validation(self):
        """Verify invalid or blank arguments raise ValueError."""
        with self.assertRaises(ValueError):
            compute_exact_key("", "m1", "v1", "hello")
        with self.assertRaises(ValueError):
            compute_exact_key("   ", "m1", "v1", "hello")
        with self.assertRaises(ValueError):
            compute_exact_key("t1", "", "v1", "hello")
        with self.assertRaises(ValueError):
            compute_exact_key("t1", "m1", "v1", "")

    def test_is_fresh(self):
        """Verify fresh, expired, and permanent entries evaluate correctly."""
        entry = CacheEntry(
            entry_id="e1",
            tenant_id="t1",
            model="m1",
            source_revision="v1",
            prompt="query",
            response="answer",
            created_at=100.0,
            ttl_seconds=50.0,
            metadata={},
        )
        self.assertTrue(is_fresh(entry, current_time=120.0))
        self.assertTrue(is_fresh(entry, current_time=150.0))
        self.assertFalse(is_fresh(entry, current_time=150.1))

        # Permanent TTL
        perm_entry = CacheEntry(
            entry_id="e2",
            tenant_id="t1",
            model="m1",
            source_revision="v1",
            prompt="query",
            response="answer",
            created_at=100.0,
            ttl_seconds=0.0,
            metadata={},
        )
        self.assertTrue(is_fresh(perm_entry, current_time=999999.0))

    def test_validate_cache_request(self):
        """Verify valid requests are normalized and invalid ones raise ValueError."""
        valid = {
            "tenant_id": "  t-100  ",
            "model": " claude-3-5-sonnet ",
            "source_revision": "rev-1",
            "prompt": " What is AI? ",
            "ttl_seconds": 1800,
            "metadata": {"user": "alice"},
        }
        sanitized = validate_cache_request(valid)
        self.assertEqual(sanitized["tenant_id"], "t-100")
        self.assertEqual(sanitized["model"], "claude-3-5-sonnet")
        self.assertEqual(sanitized["prompt"], "What is AI?")
        self.assertEqual(sanitized["ttl_seconds"], 1800.0)

        # Invalid requests
        with self.assertRaises(ValueError):
            validate_cache_request({"model": "m1", "prompt": "hello"})
        with self.assertRaises(ValueError):
            validate_cache_request({"tenant_id": "t1", "model": "m1", "prompt": "h", "ttl_seconds": -5})
        with self.assertRaises(ValueError):
            validate_cache_request({"tenant_id": "t1", "model": "m1", "prompt": "h", "ttl_seconds": float("nan")})

    def test_cache_entry_roundtrip(self):
        """Verify CacheEntry serialization roundtrip."""
        entry = CacheEntry(
            entry_id="e-test",
            tenant_id="tenant-xyz",
            model="model-abc",
            source_revision="hash-123",
            prompt="Explain quantum computing",
            response="Quantum computing leverages qubits...",
            created_at=500.0,
            ttl_seconds=3600.0,
            metadata={"priority": "high"},
        )
        d = entry.to_dict()
        reconstructed = CacheEntry.from_dict(d)
        self.assertEqual(entry, reconstructed)


if __name__ == "__main__":
    unittest.main()
