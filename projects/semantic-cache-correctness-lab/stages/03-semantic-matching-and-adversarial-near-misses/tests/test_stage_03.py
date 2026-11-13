"""Unit tests for Stage 3: Semantic Matching and Adversarial Near-Miss Guards."""

import os
import sys
import unittest

WORKSPACE = os.environ.get("PROJECT_WORKSPACE")
if WORKSPACE and WORKSPACE not in sys.path:
    sys.path.insert(0, WORKSPACE)

try:
    from main import (
        CacheEntry,
        SemanticCacheStore,
        check_adversarial_near_miss,
        compute_tf_vector,
        cosine_similarity,
        extract_negations,
        extract_numbers,
        extract_numbers_and_units,
        tokenize,
    )
except ImportError:
    pass


class TestStage03SemanticMatchingAndNearMisses(unittest.TestCase):
    """Test suite verifying vector similarity, adversarial filters, and safe semantic hits."""

    def test_tokenize_bigrams(self):
        """Verify unigram and bigram token extraction preserving word order."""
        tokens = tokenize("return policy", ngrams=True)
        self.assertIn("return", tokens)
        self.assertIn("policy", tokens)
        self.assertIn("return_policy", tokens)

    def test_cosine_similarity(self):
        """Verify vector cosine similarity calculation."""
        v1 = compute_tf_vector(tokenize("return policy defective laptop"))
        v2 = compute_tf_vector(tokenize("return policy defective laptop"))
        self.assertAlmostEqual(cosine_similarity(v1, v2), 1.0, places=4)

        v_unrelated = compute_tf_vector(tokenize("completely unrelated astronaut banana"))
        self.assertAlmostEqual(cosine_similarity(v1, v_unrelated), 0.0, places=4)

        v_partial = compute_tf_vector(tokenize("return policy"))
        self.assertTrue(0.0 < cosine_similarity(v1, v_partial) < 1.0)

    def test_extract_numbers_and_units(self):
        """Verify numerical and unit extraction and normalization."""
        self.assertEqual(extract_numbers_and_units("Price is $50 per month"), ["$50"])
        self.assertEqual(extract_numbers_and_units("Plan has 500mb storage and 50ms latency"), ["500mb", "50ms"])
        self.assertEqual(extract_numbers_and_units("Comparing 2023 with 2024 revenue"), ["2023", "2024"])

    def test_extract_negations(self):
        """Verify negation keyword detection."""
        self.assertIn("not", extract_negations("Do not deploy to prod"))
        self.assertIn("never", extract_negations("Never run on master"))
        self.assertIn("without", extract_negations("Proceed without approval"))
        self.assertIn("cannot", extract_negations("Users cannot delete records"))
        self.assertEqual(len(extract_negations("Deploy to prod")), 0)

    def test_check_adversarial_near_miss_numbers(self):
        """Verify numerical changes are flagged as adversarial near-misses."""
        q1 = "What is the price of the 50 seat license?"
        q2 = "What is the price of the 500 seat license?"
        is_bad, reason = check_adversarial_near_miss(q1, q2)
        self.assertTrue(is_bad)
        self.assertIn("number_mismatch", reason)

    def test_check_adversarial_near_miss_negation(self):
        """Verify negation additions/removals are flagged as adversarial near-misses."""
        q1 = "Can I deploy the payment service to production on Friday?"
        q2 = "Can I not deploy the payment service to production on Friday?"
        is_bad, reason = check_adversarial_near_miss(q1, q2)
        self.assertTrue(is_bad)
        self.assertIn("negation_inversion", reason)

    def test_check_adversarial_near_miss_antonyms(self):
        """Verify directional antonym swaps are flagged."""
        q1 = "How do I increase the connection limit?"
        q2 = "How do I decrease the connection limit?"
        is_bad, reason = check_adversarial_near_miss(q1, q2)
        self.assertTrue(is_bad)
        self.assertIn("antonym_divergence", reason)

    def test_check_adversarial_temporal_divergence(self):
        """Verify temporal shifts (yesterday vs tomorrow) are flagged."""
        q1 = "Show me the logs from yesterday"
        q2 = "Show me the logs from tomorrow"
        is_bad, reason = check_adversarial_near_miss(q1, q2)
        self.assertTrue(is_bad)
        self.assertIn("temporal_divergence", reason)

    def test_semantic_cache_store_safe_paraphrase_hit(self):
        """Verify genuine paraphrase with same meaning and entities produces semantic hit."""
        store = SemanticCacheStore()
        entry = CacheEntry(
            entry_id="e1",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the return policy for defective laptops?",
            response="30-day return policy.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(entry)

        matched, score, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the return policy regarding defective laptops?",
            threshold=0.75,
            current_time=100.0,
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched.response, "30-day return policy.")
        self.assertEqual(reason, "semantic_hit")
        self.assertGreaterEqual(score, 0.75)

    def test_semantic_cache_store_adversarial_rejection(self):
        """Verify queries with high similarity but inverted negation or number are rejected."""
        store = SemanticCacheStore()
        entry = CacheEntry(
            entry_id="e2",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="Can I deploy the payment service to production on Friday?",
            response="No deployments on Friday.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(entry)

        matched, score, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="Can I not deploy the payment service to production on Friday?",
            threshold=0.75,
            current_time=100.0,
        )
        self.assertIsNone(matched)
        self.assertIn("adversarial_blocked", reason)

    def test_check_adversarial_near_miss_entity_swap(self):
        """Verify entity identifier swaps (such as alpha vs beta) are flagged."""
        q1 = "What is the deployment status of project alpha?"
        q2 = "What is the deployment status of project beta?"
        is_bad, reason = check_adversarial_near_miss(q1, q2)
        self.assertTrue(is_bad)
        self.assertIn("entity_mismatch", reason)

    def test_semantic_cache_store_replaced_entry_overwrites_partition(self):
        """Verify replacing an exact key updates semantic partition without leaving stale answers."""
        store = SemanticCacheStore()
        entry_old = CacheEntry(
            entry_id="e-rep",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the refund policy for defective laptops?",
            response="Old 14-day policy.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(entry_old)

        entry_new = CacheEntry(
            entry_id="e-rep",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the refund policy for defective laptops?",
            response="Updated 60-day policy.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(entry_new)

        matched, _, _ = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the refund policy regarding defective laptops?",
            threshold=0.75,
            current_time=100.0,
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched.response, "Updated 60-day policy.")

    def test_semantic_cache_store_safe_candidate_fallback(self):
        """Verify query falls back to a safe candidate when the top candidate is an adversarial near-miss."""
        store = SemanticCacheStore()
        # Candidate 1: Very high similarity to query, but inverted negation (adversarial)
        adv_entry = CacheEntry(
            entry_id="e-adv",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="Can I not deploy the payment service to production on Friday?",
            response="Adversarial answer.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(adv_entry)

        # Candidate 2: High similarity safe paraphrase
        safe_entry = CacheEntry(
            entry_id="e-safe",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="Can I deploy the payment service to production on Friday?",
            response="Safe approved answer.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(safe_entry)

        query = "Can I deploy the payment service to production on Friday afternoon?"
        matched, score, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt=query,
            threshold=0.70,
            current_time=100.0,
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched.response, "Safe approved answer.")
        self.assertEqual(reason, "semantic_hit")

    def test_semantic_cache_store_policy_context_isolation(self):
        """Verify semantic matching does not cross differing extra_params policy contexts."""
        store = SemanticCacheStore()
        entry_admin = CacheEntry(
            entry_id="e-admin",
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the support contact email?",
            response="admin-vip@example.com",
            created_at=100.0,
            ttl_seconds=3600.0,
            metadata={"extra_params": {"audience": "internal"}},
        )
        store.put(entry_admin)

        matched_diff_policy, _, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the support contact address?",
            threshold=0.75,
            current_time=100.0,
            extra_params={"audience": "public"},
        )
        self.assertIsNone(matched_diff_policy)
        self.assertEqual(reason, "partition_empty")

    def test_semantic_cache_store_cross_tenant_isolation(self):
        """Verify semantic matching never crosses tenant partition even for identical prompts."""
        store = SemanticCacheStore()
        entry = CacheEntry(
            entry_id="e3",
            tenant_id="tenant-secret",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is our confidential revenue target for 2025?",
            response="Target is $100M.",
            created_at=100.0,
            ttl_seconds=3600.0,
        )
        store.put(entry)

        matched, score, reason = store.query(
            tenant_id="tenant-other",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is our confidential revenue target for 2025?",
            threshold=0.75,
            current_time=100.0,
        )
        self.assertIsNone(matched)
        self.assertEqual(reason, "partition_empty")


if __name__ == "__main__":
    unittest.main()
