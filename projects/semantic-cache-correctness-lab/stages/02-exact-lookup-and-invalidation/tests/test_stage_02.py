"""Unit tests for Stage 2: Exact-Match Lookup and Scoped Invalidation."""

import os
import sys
import unittest

WORKSPACE = os.environ.get("PROJECT_WORKSPACE")
if WORKSPACE and WORKSPACE not in sys.path:
    sys.path.insert(0, WORKSPACE)

try:
    from main import CacheEntry, ExactCacheStore
except ImportError:
    pass


class TestStage02ExactLookupAndInvalidation(unittest.TestCase):
    """Test suite verifying exact cache storage, TTL eviction, and scoped invalidation."""

    def setUp(self):
        self.store = ExactCacheStore()
        self.entry_a = CacheEntry(
            entry_id="e1",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="What is the refund window?",
            response="30 days from purchase.",
            created_at=1000.0,
            ttl_seconds=3600.0,
            metadata={},
        )
        self.entry_b = CacheEntry(
            entry_id="e2",
            tenant_id="tenant-beta",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="What is the refund window?",
            response="14 days from delivery.",
            created_at=1000.0,
            ttl_seconds=3600.0,
            metadata={},
        )

    def test_put_and_get_exact_hit(self):
        """Verify successful insertion and exact-match retrieval."""
        key = self.store.put(self.entry_a)
        self.assertEqual(len(key), 64)

        retrieved = self.store.get(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="What is the refund window?",
            current_time=1500.0,
        )
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.response, "30 days from purchase.")
        self.assertEqual(self.store.stats()["hits"], 1)

    def test_get_miss_on_unknown(self):
        """Verify cache miss on non-existent query."""
        res = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "Unknown query", 1000.0)
        self.assertIsNone(res)
        self.assertEqual(self.store.stats()["misses"], 1)

    def test_ttl_eviction_on_get(self):
        """Verify expired entries are evicted and return None."""
        self.store.put(self.entry_a)
        # Entry expires at 1000.0 + 3600.0 = 4600.0
        # Query at 4601.0
        res = self.store.get(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="What is the refund window?",
            current_time=4601.0,
        )
        self.assertIsNone(res)
        stats = self.store.stats()
        self.assertEqual(stats["evictions"], 1)
        self.assertEqual(stats["misses"], 1)
        self.assertEqual(stats["active_entries"], 0)

    def test_cross_tenant_isolation_in_store(self):
        """Verify tenant partitions cannot access each other's cached responses."""
        self.store.put(self.entry_a)
        self.store.put(self.entry_b)

        # Alpha accesses alpha
        res_a = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertEqual(res_a.response, "30 days from purchase.")

        # Beta accesses beta
        res_b = self.store.get("tenant-beta", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertEqual(res_b.response, "14 days from delivery.")

        # Gamma misses completely
        res_c = self.store.get("tenant-gamma", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(res_c)

    def test_invalidate_tenant(self):
        """Verify purging a specific tenant removes all its entries without affecting other tenants."""
        self.store.put(self.entry_a)
        self.store.put(self.entry_b)
        self.assertEqual(self.store.stats()["active_entries"], 2)

        evicted_count = self.store.invalidate_tenant("tenant-alpha")
        self.assertEqual(evicted_count, 1)
        self.assertEqual(self.store.stats()["active_entries"], 1)

        # Alpha is gone
        res_a = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(res_a)

        # Beta remains intact
        res_b = self.store.get("tenant-beta", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNotNone(res_b)

    def test_invalidate_source_revision(self):
        """Verify invalidating a source revision purges outdated entries."""
        entry_old = CacheEntry(
            entry_id="e3",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="Tax rate",
            response="8%",
            created_at=1000.0,
            ttl_seconds=3600.0,
            metadata={},
        )
        entry_new = CacheEntry(
            entry_id="e4",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v2.0",
            prompt="Tax rate",
            response="9.5%",
            created_at=1000.0,
            ttl_seconds=3600.0,
            metadata={},
        )
        self.store.put(entry_old)
        self.store.put(entry_new)

        purged = self.store.invalidate_source_revision("v1.0")
        self.assertEqual(purged, 1)

        # v1.0 misses
        res_old = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "Tax rate", 1000.0)
        self.assertIsNone(res_old)

        # v2.0 remains
        res_new = self.store.get("tenant-alpha", "gpt-4o", "v2.0", "Tax rate", 1000.0)
        self.assertIsNotNone(res_new)
        self.assertEqual(res_new.response, "9.5%")

    def test_store_stats_tracking(self):
        """Verify metrics counter accurately tracks operational events."""
        self.store.put(self.entry_a)
        self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)  # hit
        self.store.get("tenant-alpha", "gpt-4o", "v1.0", "Non-existent", 1000.0)               # miss
        self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 5000.0)  # expired -> miss + eviction

        stats = self.store.stats()
        self.assertEqual(stats["hits"], 1)
        self.assertEqual(stats["misses"], 2)
        self.assertEqual(stats["evictions"], 1)
        self.assertEqual(stats["active_entries"], 0)


if __name__ == "__main__":
    unittest.main()
