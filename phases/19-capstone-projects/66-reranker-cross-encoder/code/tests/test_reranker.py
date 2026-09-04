"""Tests for the cross-encoder reranker and the two-stage pipeline."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import torch  # noqa: E402

from main import (  # noqa: E402
    BiEncoder,
    CORPUS,
    Candidate,
    CrossEncoder,
    TRAIN_TRIPLES,
    Triple,
    _set_seed,
    pipeline,
    rerank,
    tokenize_pair,
    train_tiny,
)


class TestTokenizePair(unittest.TestCase):
    def test_packs_with_separators(self) -> None:
        ids, tids = tokenize_pair("abort upload", "abort the upload", max_len=16)
        self.assertEqual(ids[0], 2)  # CLS
        self.assertIn(1, ids)  # SEP appears
        self.assertEqual(len(ids), 16)
        self.assertEqual(len(tids), 16)

    def test_type_ids_split_query_and_doc(self) -> None:
        ids, tids = tokenize_pair("alpha", "beta gamma", max_len=12)
        # type_ids start as zero (query), flip to 1 (doc) after first SEP
        self.assertEqual(tids[0], 0)
        ones = [t for t in tids if t == 1]
        self.assertGreater(len(ones), 0)

    def test_truncates_past_max_len(self) -> None:
        long_doc = " ".join(["word"] * 200)
        ids, tids = tokenize_pair("query", long_doc, max_len=32)
        self.assertEqual(len(ids), 32)


class TestCrossEncoderForward(unittest.TestCase):
    def test_forward_returns_scalar_per_batch_row(self) -> None:
        _set_seed()
        model = CrossEncoder(d_model=32, n_heads=4, max_len=48)
        ids = torch.randint(3, 100, (4, 48))
        tids = torch.zeros((4, 48), dtype=torch.long)
        out = model(ids, tids)
        self.assertEqual(tuple(out.shape), (4,))

    def test_deterministic_init(self) -> None:
        _set_seed()
        a = CrossEncoder(d_model=32, n_heads=4, max_len=48)
        _set_seed()
        b = CrossEncoder(d_model=32, n_heads=4, max_len=48)
        for pa, pb in zip(a.parameters(), b.parameters()):
            self.assertTrue(torch.allclose(pa, pb))


class TestTrainTiny(unittest.TestCase):
    def test_loss_decreases(self) -> None:
        _set_seed()
        model = CrossEncoder(d_model=32, n_heads=4, max_len=48)
        losses = train_tiny(model, TRAIN_TRIPLES, epochs=40, lr=5e-3)
        self.assertLess(losses[-1], losses[0])
        self.assertLess(losses[-1], 0.1)

    def test_positive_scores_above_negative_after_training(self) -> None:
        _set_seed()
        model = CrossEncoder()
        train_tiny(model, TRAIN_TRIPLES, epochs=60, lr=5e-3)
        pos_query = "how do we abort a multipart upload"
        neg = Candidate("dx", "fluffy clouds drift across a summer afternoon sky")
        pos = Candidate("dy", "AbortMultipartOnFail aborts an in-flight S3 multipart upload "
                              "and decrements the per-bucket retry budget.")
        scored = rerank(model, pos_query, [neg, pos], top_k=2)
        # pos should land at rank 1 after training
        self.assertEqual(scored[0][0].doc_id, "dy")


class TestRerank(unittest.TestCase):
    def test_returns_top_k(self) -> None:
        _set_seed()
        model = CrossEncoder()
        cands = [Candidate(f"d{i}", f"text {i}") for i in range(5)]
        scored = rerank(model, "any query", cands, top_k=3)
        self.assertEqual(len(scored), 3)

    def test_handles_empty(self) -> None:
        _set_seed()
        model = CrossEncoder()
        self.assertEqual(rerank(model, "q", [], top_k=3), [])

    def test_top_k_larger_than_input_returns_all(self) -> None:
        _set_seed()
        model = CrossEncoder()
        cands = [Candidate("a", "x"), Candidate("b", "y")]
        scored = rerank(model, "q", cands, top_k=10)
        self.assertEqual(len(scored), 2)


class TestPipeline(unittest.TestCase):
    def test_pipeline_reports_two_latencies(self) -> None:
        _set_seed()
        retriever = BiEncoder()
        for c in CORPUS:
            retriever.add(c)
        model = CrossEncoder()
        train_tiny(model, TRAIN_TRIPLES, epochs=40)
        result = pipeline("how do we cancel a job", retriever, model, top_n=6, top_k=3)
        self.assertIn("retrieve_top_n", result)
        self.assertIn("reranked_top_k", result)
        self.assertGreater(result["latency_retrieve_ms"], 0.0)
        self.assertGreater(result["latency_rerank_ms"], 0.0)
        self.assertEqual(len(result["reranked_top_k"]), 3)

    def test_pipeline_reorders_bi_encoder_output(self) -> None:
        _set_seed()
        retriever = BiEncoder()
        for c in CORPUS:
            retriever.add(c)
        model = CrossEncoder()
        train_tiny(model, TRAIN_TRIPLES, epochs=60)
        result = pipeline("how do we abort a multipart upload",
                          retriever, model, top_n=8, top_k=3)
        # rerank should keep d1 (the abort doc) somewhere in top-3
        top_ids = [c.doc_id for c, _ in result["reranked_top_k"]]
        self.assertIn("d1", top_ids)


if __name__ == "__main__":
    unittest.main()
