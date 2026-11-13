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
        tokenize,
    )
except ImportError:
    pass


class TestStage03SemanticMatchingAndNearMisses(unittest.TestCase):
    """Test suite verifying vector similarity, adversarial filters, and safe semantic hits."""

    def test_cosine_similarity(self):
        """Verify vector cosine similarity calculation."""
        v1 = compute_tf_vector(tokenize("return policy defective laptop"))
        v2 = compute_tf_vector(tokenize("return policy defective laptop"))
        self.assertAlmostEqual(cosine_similarity(v1, v2), 1.0, places=4)

        v_unrelated = compute_tf_vector(tokenize("completely unrelated astronaut banana"))
        self.assertAlmostEqual(cosine_similarity(v1, v_unrelated), 0.0, places=4)

        v_partial = compute_tf_vector(tokenize("return policy"))
        self.assertTrue(0.0 < cosine_similarity(v1, v_partial) < 1.0)

    def test_extract_numbers(self):
        """Verify numerical extraction and normalization."""
        self.assertEqual(extract_numbers("Price is $50 per month"), ["50"])
        self.assertEqual(extract_numbers("Tier for 500 users costs $450.00"), ["450", "500"])
        self.assertEqual(extract_numbers("Comparing 2023 with 2024 revenue"), ["2023", "2024"])
        self.assertEqual(extract_numbers("No numbers here"), [])

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
            metadata={},
        )
        store.put(entry)

        matched, score, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is the return policy regarding defective laptops?",
            threshold=0.80,
            current_time=100.0,
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched.response, "30-day return policy.")
        self.assertEqual(reason, "semantic_hit")
        self.assertGreaterEqual(score, 0.80)

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
            metadata={},
        )
        store.put(entry)

        matched, score, reason = store.query(
            tenant_id="tenant-alpha",
            model="gpt-4o",
            source_revision="v1",
            prompt="Can I not deploy the payment service to production on Friday?",
            threshold=0.80,
            current_time=100.0,
        )
        self.assertIsNone(matched)
        self.assertIn("adversarial_blocked", reason)

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
            metadata={},
        )
        store.put(entry)

        # Another tenant asks the exact same question
        matched, score, reason = store.query(
            tenant_id="tenant-other",
            model="gpt-4o",
            source_revision="v1",
            prompt="What is our confidential revenue target for 2025?",
            threshold=0.80,
            current_time=100.0,
        )
        self.assertIsNone(matched)
        self.assertEqual(reason, "partition_empty")


if __name__ == "__main__":
    unittest.main()
