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
    """Test suite verifying exact cache storage, TTL eviction, tenant quotas, and scoped invalidation."""

    def setUp(self):
        self.store = ExactCacheStore(max_entries_per_tenant=2)
        self.entry_a = CacheEntry(
            entry_id="e1",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="What is the refund window?",
            response="30 days from purchase.",
            created_at=1000.0,
            ttl_seconds=3600.0,
            tags=["billing"],
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
            tags=["support"],
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

        res_a = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertEqual(res_a.response, "30 days from purchase.")

        res_b = self.store.get("tenant-beta", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertEqual(res_b.response, "14 days from delivery.")

        res_c = self.store.get("tenant-gamma", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(res_c)

    def test_tenant_quota_lru_eviction(self):
        """Verify exceeding a tenant's quota evicts their oldest entry without touching other tenants."""
        # Tenant alpha fills its 2-entry quota
        self.store.put(self.entry_a)  # e1 (oldest)
        e_alpha_2 = CacheEntry(
            entry_id="e1-2",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="Alpha query 2",
            response="A2",
            created_at=1000.0,
            ttl_seconds=3600.0,
        )
        self.store.put(e_alpha_2)

        # Tenant beta puts 1 entry
        self.store.put(self.entry_b)
        self.assertEqual(self.store.stats()["active_entries"], 3)

        # Tenant alpha inserts a 3rd entry -> e1 should be evicted by LRU!
        e_alpha_3 = CacheEntry(
            entry_id="e1-3",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1.0",
            prompt="Alpha query 3",
            response="A3",
            created_at=1000.0,
            ttl_seconds=3600.0,
        )
        self.store.put(e_alpha_3)

        # e1 should now miss because it was evicted under LRU quota
        miss_e1 = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(miss_e1)

        # e_alpha_2 and e_alpha_3 are intact
        hit_e2 = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "Alpha query 2", 1000.0)
        self.assertIsNotNone(hit_e2)

        # Tenant beta entry is completely unaffected!
        hit_beta = self.store.get("tenant-beta", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNotNone(hit_beta)
        self.assertEqual(hit_beta.response, "14 days from delivery.")

    def test_invalidate_tenant(self):
        """Verify purging a specific tenant removes all its entries without affecting other tenants."""
        self.store.put(self.entry_a)
        self.store.put(self.entry_b)
        self.assertEqual(self.store.stats()["active_entries"], 2)

        evicted_count = self.store.invalidate_tenant("tenant-alpha")
        self.assertEqual(evicted_count, 1)
        self.assertEqual(self.store.stats()["active_entries"], 1)

        res_a = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(res_a)

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
        )
        self.store.put(entry_old)
        self.store.put(entry_new)

        purged = self.store.invalidate_source_revision("v1.0")
        self.assertEqual(purged, 1)

        res_old = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "Tax rate", 1000.0)
        self.assertIsNone(res_old)

        res_new = self.store.get("tenant-alpha", "gpt-4o", "v2.0", "Tax rate", 1000.0)
        self.assertIsNotNone(res_new)
        self.assertEqual(res_new.response, "9.5%")

    def test_invalidate_tag(self):
        """Verify metadata tag based invalidation."""
        self.store.put(self.entry_a)  # tag: billing
        self.store.put(self.entry_b)  # tag: support
        self.assertEqual(self.store.stats()["active_entries"], 2)

        purged = self.store.invalidate_tag("billing")
        self.assertEqual(purged, 1)

        res_a = self.store.get("tenant-alpha", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNone(res_a)

        res_b = self.store.get("tenant-beta", "gpt-4o", "v1.0", "What is the refund window?", 1000.0)
        self.assertIsNotNone(res_b)


if __name__ == "__main__":
    unittest.main()
