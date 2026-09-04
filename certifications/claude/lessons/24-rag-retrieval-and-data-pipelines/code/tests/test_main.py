import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("retrieval_lab", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class RetrievalLabTests(unittest.TestCase):
    def test_tokenize_normalizes_case_and_punctuation(self):
        self.assertEqual(MODULE.tokenize("Refund, APPROVAL!"), ["refund", "approval"])

    def test_chunking_preserves_overlap(self):
        document = MODULE.Document("d", "one two three four five six", "2026-01-01")
        chunks = MODULE.chunk_document(document, max_words=4, overlap_words=2)
        self.assertEqual(chunks[0].text, "one two three four")
        self.assertEqual(chunks[1].text, "three four five six")

    def test_chunking_rejects_invalid_overlap(self):
        document = MODULE.Document("d", "one two", "2026-01-01")
        with self.assertRaises(ValueError):
            MODULE.chunk_document(document, max_words=2, overlap_words=2)

    def test_build_excludes_inactive_documents(self):
        documents = [
            MODULE.Document("active", "current refund rule", "2026-01-01"),
            MODULE.Document("stale", "obsolete refund rule", "2025-01-01", active=False),
        ]
        index = MODULE.RetrievalIndex.build(documents)
        self.assertEqual({chunk.document_id for chunk in index.chunks}, {"active"})

    def test_search_returns_relevant_document_first(self):
        documents = [
            MODULE.Document("refund", "refund approval threshold finance", "2026-01-01"),
            MODULE.Document("shipping", "shipping delay carrier parcel", "2026-01-01"),
        ]
        hits = MODULE.RetrievalIndex.build(documents).search("finance refund approval")
        self.assertEqual(hits[0].document_id, "refund")

    def test_empty_query_returns_no_hits(self):
        index = MODULE.RetrievalIndex.build([MODULE.Document("d", "some text", "2026-01-01")])
        self.assertEqual(index.search("!!!"), [])

    def test_search_rejects_non_positive_top_k(self):
        index = MODULE.RetrievalIndex.build([MODULE.Document("d", "some text", "2026-01-01")])
        with self.assertRaises(ValueError):
            index.search("text", top_k=0)

    def test_evaluation_reports_recall_and_rank(self):
        documents = [
            MODULE.Document("refund", "refund approval finance", "2026-01-01"),
            MODULE.Document("shipping", "shipping delay parcel", "2026-01-01"),
        ]
        index = MODULE.RetrievalIndex.build(documents)
        metrics = MODULE.evaluate_retrieval(index, [MODULE.RetrievalCase("refund finance", ("refund",))], top_k=1)
        self.assertEqual(metrics, {"recall_at_k": 1.0, "mean_reciprocal_rank": 1.0})


if __name__ == "__main__":
    unittest.main()
