"""Tests for BM25, dense, RRF, and the hybrid retriever wiring."""

from __future__ import annotations

import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BM25Index,
    CORPUS,
    DenseIndex,
    Doc,
    HybridRetriever,
    cosine,
    mock_embed,
    rrf,
    tokenize,
)


class TestTokenizer(unittest.TestCase):
    def test_lowercase_and_strip_punct(self) -> None:
        self.assertEqual(tokenize("AbortMultipart, On Fail!"), ["abortmultipart", "on", "fail"])

    def test_alnum_only(self) -> None:
        self.assertEqual(tokenize("v1.2-rc3"), ["v1", "2", "rc3"])


class TestBM25(unittest.TestCase):
    def setUp(self) -> None:
        self.idx = BM25Index()
        for d in CORPUS:
            self.idx.add(d)

    def test_literal_match_ranks_first(self) -> None:
        hits = self.idx.search("AbortMultipartOnFail", k=3)
        self.assertGreater(len(hits), 0)
        self.assertEqual(hits[0][0].doc_id, "d1")

    def test_unknown_term_returns_empty(self) -> None:
        hits = self.idx.search("xyzzyxnotinthecorpus", k=5)
        self.assertEqual(hits, [])

    def test_field_weight_boost(self) -> None:
        unweighted = BM25Index(field_weights={"title": 1, "body": 1})
        weighted = BM25Index(field_weights={"title": 5, "body": 1})
        for d in CORPUS:
            unweighted.add(d)
            weighted.add(d)
        u_hits = unweighted.search("authorization", k=2)
        w_hits = weighted.search("authorization", k=2)
        self.assertGreaterEqual(w_hits[0][1], u_hits[0][1])


class TestDense(unittest.TestCase):
    def setUp(self) -> None:
        self.idx = DenseIndex()
        for d in CORPUS:
            self.idx.add(d)

    def test_deterministic(self) -> None:
        a = self.idx.search("how do we handle cancelled uploads", 3)
        b = self.idx.search("how do we handle cancelled uploads", 3)
        self.assertEqual([d.doc_id for d, _ in a], [d.doc_id for d, _ in b])

    def test_unit_norm_embedding(self) -> None:
        v = mock_embed("anything")
        self.assertAlmostEqual(sum(x * x for x in v), 1.0, places=4)

    def test_paraphrased_query_finds_upload_doc(self) -> None:
        hits = self.idx.search("how do we handle cancelled uploads", 5)
        ids = [d.doc_id for d, _ in hits]
        self.assertIn("d2", ids[:3])


class TestRRF(unittest.TestCase):
    def test_basic_fusion(self) -> None:
        d1 = Doc("a", "t", "")
        d2 = Doc("b", "t", "")
        d3 = Doc("c", "t", "")
        l1 = [(d1, 9.0), (d2, 5.0), (d3, 1.0)]
        l2 = [(d2, 9.0), (d1, 5.0), (d3, 1.0)]
        fused = rrf([l1, l2], k=60)
        # d1 and d2 share rank 1+2, so each should beat d3
        self.assertIn(fused[0][0].doc_id, {"a", "b"})
        self.assertEqual(fused[-1][0].doc_id, "c")

    def test_weights_change_ranking(self) -> None:
        d1 = Doc("a", "t", "")
        d2 = Doc("b", "t", "")
        l1 = [(d1, 1.0)]
        l2 = [(d2, 1.0)]
        flat = rrf([l1, l2], k=60, weights=[1.0, 1.0])
        bm25_heavy = rrf([l1, l2], k=60, weights=[5.0, 1.0])
        self.assertEqual(bm25_heavy[0][0].doc_id, "a")
        # under flat weights ties are broken by insertion order
        self.assertEqual({d.doc_id for d, _ in flat[:2]}, {"a", "b"})

    def test_weights_length_mismatch_raises(self) -> None:
        with self.assertRaises(ValueError):
            rrf([[], []], k=60, weights=[1.0])

    def test_smaller_k_concentrates_score_on_top(self) -> None:
        d1 = Doc("a", "t", "")
        d2 = Doc("b", "t", "")
        l1 = [(d1, 1.0), (d2, 0.5)]
        big = rrf([l1], k=1000)
        small = rrf([l1], k=1)
        self.assertGreater(small[0][1] / small[1][1], big[0][1] / big[1][1])


class TestHybridRetriever(unittest.TestCase):
    def setUp(self) -> None:
        self.r = HybridRetriever()
        for d in CORPUS:
            self.r.add(d)

    def test_search_returns_three_lists(self) -> None:
        out = self.r.search("rank fusion", k_each=3, k_out=3)
        for key in ("bm25", "dense", "fused"):
            self.assertIn(key, out)
        self.assertLessEqual(len(out["fused"]), 3)

    def test_fused_contains_union_of_top1s(self) -> None:
        out = self.r.search("how do we handle cancelled uploads", k_each=5, k_out=5)
        fused_ids = [d.doc_id for d, _ in out["fused"]]
        bm25_top = out["bm25"][0][0].doc_id if out["bm25"] else None
        dense_top = out["dense"][0][0].doc_id if out["dense"] else None
        if bm25_top:
            self.assertIn(bm25_top, fused_ids)
        if dense_top:
            self.assertIn(dense_top, fused_ids)

    def test_literal_query_wins_in_fused(self) -> None:
        out = self.r.search("AbortMultipartOnFail", k_each=5, k_out=5)
        self.assertEqual(out["fused"][0][0].doc_id, "d1")


if __name__ == "__main__":
    unittest.main()
