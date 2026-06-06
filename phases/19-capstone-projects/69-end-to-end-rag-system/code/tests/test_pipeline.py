"""Tests for the end-to-end RAG pipeline and the eval threshold gate."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    CORPUS,
    Chunker,
    EVAL_QUERIES,
    HybridIndex,
    Pipeline,
    REFUSE_TEXT,
    Result,
    Rewriter,
    THRESHOLDS,
    answer_relevance_score,
    build_pipeline,
    doc_level_mrr,
    doc_level_precision,
    doc_level_recall,
    faithfulness_score,
    generate_answer,
    run_demo,
    run_eval,
)


class TestChunker(unittest.TestCase):
    def test_one_chunk_for_short_text(self) -> None:
        chunker = Chunker(target=200)
        chunks = chunker.chunk("d1", "short text")
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].doc_id, "d1")
        self.assertEqual(chunks[0].chunk_index, 0)

    def test_anchor_format(self) -> None:
        chunker = Chunker(target=200)
        chunks = chunker.chunk("d1", "x")
        self.assertEqual(chunks[0].anchor(), "d1:0")


class TestHybridIndex(unittest.TestCase):
    def test_search_returns_chunks(self) -> None:
        idx = HybridIndex()
        chunker = Chunker()
        for doc_id, text in CORPUS[:3]:
            for c in chunker.chunk(doc_id, text):
                idx.add(c)
        results = idx.search("abort upload", k_out=5)
        self.assertGreater(len(results), 0)


class TestRewriter(unittest.TestCase):
    def test_strategy_decompose_on_and(self) -> None:
        rw = Rewriter()
        self.assertEqual(rw.pick_strategy("how is A handled and how is B handled"), "decompose")

    def test_strategy_hyde_on_jargon(self) -> None:
        rw = Rewriter()
        self.assertEqual(rw.pick_strategy("where is the auth function defined"), "hyde")

    def test_strategy_default_multiquery(self) -> None:
        rw = Rewriter()
        self.assertEqual(rw.pick_strategy("how do you stop a worker"), "multiquery")


class TestGenerator(unittest.TestCase):
    def test_refuses_when_top_score_below_threshold(self) -> None:
        from main import Chunk
        ranked = [(Chunk("d1", 0, "irrelevant content"), 0.001)]
        ans, cites = generate_answer("query about budgets", ranked)
        self.assertEqual(ans, REFUSE_TEXT)
        self.assertEqual(cites, [])

    def test_refuses_on_empty(self) -> None:
        ans, cites = generate_answer("any query", [])
        self.assertEqual(ans, REFUSE_TEXT)
        self.assertEqual(cites, [])

    def test_emits_citation_anchor(self) -> None:
        from main import Chunk
        ranked = [(Chunk("d1", 0, "abort threshold is three failed parts per bucket"), 0.5)]
        ans, cites = generate_answer("what is the abort threshold", ranked)
        self.assertIn("[d1:0]", ans)
        self.assertEqual(cites, ["d1:0"])


class TestMetrics(unittest.TestCase):
    def setUp(self) -> None:
        from main import Chunk
        self.ranked = [(Chunk("d3", 0, "x"), 0.5),
                       (Chunk("d1", 0, "x"), 0.4),
                       (Chunk("d9", 0, "x"), 0.3)]

    def test_recall(self) -> None:
        r = doc_level_recall(self.ranked, {"d1", "d3"}, k=3)
        self.assertEqual(r, 1.0)

    def test_precision(self) -> None:
        p = doc_level_precision(self.ranked, {"d3"}, k=1)
        self.assertEqual(p, 1.0)

    def test_mrr_first_unique_doc(self) -> None:
        self.assertEqual(doc_level_mrr(self.ranked, {"d1"}), 0.5)

    def test_mrr_no_hit(self) -> None:
        self.assertEqual(doc_level_mrr(self.ranked, {"dx"}), 0.0)

    def test_faithfulness_refuse_with_empty_topk_is_one(self) -> None:
        self.assertEqual(faithfulness_score(REFUSE_TEXT, []), 1.0)

    def test_answer_relevance(self) -> None:
        r = answer_relevance_score(
            "where is authorization centralized",
            "Authorization is centralized in check_permission",
        )
        self.assertEqual(r, 1.0)


class TestPipelineQuery(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.pipeline = build_pipeline()

    def test_returns_result_with_top_k(self) -> None:
        r = self.pipeline.query(EVAL_QUERIES[2].query)
        self.assertIsInstance(r, Result)
        self.assertGreater(len(r.top_k), 0)
        self.assertIn(r.rewriter_strategy, ("hyde", "multiquery", "decompose"))

    def test_latencies_reported_per_stage(self) -> None:
        r = self.pipeline.query(EVAL_QUERIES[1].query)
        for stage in ("rewrite", "retrieve", "rerank", "generate"):
            self.assertIn(stage, r.latency_ms)
            self.assertGreaterEqual(r.latency_ms[stage], 0.0)

    def test_answer_carries_citations(self) -> None:
        r = self.pipeline.query(EVAL_QUERIES[2].query)
        self.assertTrue(r.citations or r.answer == REFUSE_TEXT)


class TestDemoEval(unittest.TestCase):
    def test_eval_meets_thresholds(self) -> None:
        p = build_pipeline()
        metrics = run_eval(p)
        for name, threshold in THRESHOLDS.items():
            self.assertGreaterEqual(metrics[name], threshold,
                                    f"{name} below threshold")

    def test_run_demo_exits_zero(self) -> None:
        rc = run_demo()
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
