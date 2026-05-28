"""HDF5 tokenized corpus pipeline の unit tests。

実行: python3 -m unittest discover code/tests -v
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import h5py
import numpy as np

from main import (
    BOUNDARY_TOKEN_ID,
    DEFAULT_CHUNK_SIZE,
    HDF5ShardWriter,
    JSONLSource,
    MmapTokenStore,
    ShardIndexEntry,
    ShardedTokenizationPipeline,
    SlidingWindowDataloader,
    TOKEN_DTYPE,
    Tokenizer,
    build_demo_corpus,
    load_index,
    pack_documents,
    validate_corpus,
)


class TokenizerTests(unittest.TestCase):
    def test_encode_round_trip_preserves_ascii(self) -> None:
        tokenizer = Tokenizer()
        ids = tokenizer.encode("hello")
        self.assertEqual(tokenizer.decode(ids), "hello")

    def test_empty_encode_returns_empty_list(self) -> None:
        self.assertEqual(Tokenizer().encode(""), [])

    def test_boundary_token_is_reserved(self) -> None:
        tokenizer = Tokenizer()
        ids = tokenizer.encode("a")
        self.assertNotIn(0, ids)


class ShardWriterTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_writer_rejects_zero_chunk(self) -> None:
        with self.assertRaises(ValueError):
            HDF5ShardWriter(self.tmp / "x.h5", chunk_size=0)

    def test_writer_persists_token_count_attribute(self) -> None:
        path = self.tmp / "shard.h5"
        writer = HDF5ShardWriter(path, chunk_size=8)
        with writer:
            writer.add_document([1, 2, 3, 4, 5])
            writer.add_boundary()
            writer.add_document([6, 7, 8, 9])
        with h5py.File(path, "r") as fh:
            dataset = fh["tokens"]
            self.assertEqual(int(dataset.attrs["token_count"]), 10)

    def test_writer_chunk_alignment_produces_chunked_dataset(self) -> None:
        path = self.tmp / "aligned.h5"
        writer = HDF5ShardWriter(path, chunk_size=4)
        with writer:
            writer.add_document(list(range(1, 17)))  # 16 tokens
        with h5py.File(path, "r") as fh:
            dataset = fh["tokens"]
            self.assertEqual(dataset.shape, (16,))
            self.assertEqual(dataset.chunks, (4,))

    def test_sha256_matches_recomputed_value(self) -> None:
        path = self.tmp / "hashed.h5"
        writer = HDF5ShardWriter(path, chunk_size=4)
        with writer:
            writer.add_document([1, 2, 3, 4, 5, 6, 7])
        result = writer.result("shard")
        with h5py.File(path, "r") as fh:
            tokens = np.asarray(fh["tokens"][: result.token_count], dtype=TOKEN_DTYPE)
            recomputed = hashlib.sha256(tokens.tobytes()).hexdigest()
        self.assertEqual(recomputed, result.sha256)


class PipelineTests(unittest.TestCase):
    def test_pipeline_writes_index_with_global_starts(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=64)
            entries = pipeline.write_corpus(
                {
                    "shard-0000": ["alpha beta", "gamma delta"],
                    "shard-0001": ["epsilon zeta"],
                }
            )
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0].global_start, 0)
            self.assertEqual(entries[1].global_start, entries[0].token_count)
            index_path = out / "shards.json"
            self.assertTrue(index_path.exists())
            data = json.loads(index_path.read_text("utf-8"))
            self.assertEqual(data["total_tokens"], entries[0].token_count + entries[1].token_count)

    def test_load_index_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=32)
            entries = pipeline.write_corpus({"shard-0000": ["abc def"]})
            reloaded = load_index(out / "shards.json")
            self.assertEqual(len(reloaded), 1)
            self.assertEqual(reloaded[0].sha256, entries[0].sha256)

    def test_validate_corpus_passes_for_intact_shards(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=32)
            entries = pipeline.write_corpus(build_demo_corpus())
            failures = validate_corpus(entries)
            self.assertEqual(failures, [])


class MmapStoreTests(unittest.TestCase):
    def test_get_slice_spans_two_shards(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=16)
            entries = pipeline.write_corpus(
                {
                    "shard-0000": ["alphabet soup"],
                    "shard-0001": ["beta charlie delta"],
                }
            )
            with MmapTokenStore(entries) as store:
                total = store.total_tokens
                slice_a = store.get_slice(0, total)
                self.assertEqual(slice_a.shape, (total,))
                mid = total // 2
                self.assertTrue(np.array_equal(store.get_slice(0, mid), slice_a[:mid]))
                self.assertTrue(np.array_equal(store.get_slice(mid, total), slice_a[mid:]))

    def test_get_slice_rejects_oob_request(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=16)
            entries = pipeline.write_corpus({"shard-0000": ["alphabet soup"]})
            with MmapTokenStore(entries) as store:
                with self.assertRaises(ValueError):
                    store.get_slice(0, store.total_tokens + 1)


class DataloaderTests(unittest.TestCase):
    def test_dataloader_emits_shifted_targets(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=64)
            entries = pipeline.write_corpus(build_demo_corpus())
            with MmapTokenStore(entries) as store:
                loader = SlidingWindowDataloader(store, window_size=16, batch_size=2, seed=42)
                batches = loader.take(3)
            self.assertEqual(len(batches), 3)
            for inputs, targets in batches:
                self.assertEqual(inputs.shape, (2, 16))
                self.assertEqual(targets.shape, (2, 16))

    def test_dataloader_deterministic_with_seed(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            out = Path(out_dir)
            tokenizer = Tokenizer()
            pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=64)
            entries = pipeline.write_corpus(build_demo_corpus())
            with MmapTokenStore(entries) as store:
                loader_a = SlidingWindowDataloader(store, window_size=16, batch_size=2, seed=11)
                loader_b = SlidingWindowDataloader(store, window_size=16, batch_size=2, seed=11)
                batches_a = loader_a.take(4)
                batches_b = loader_b.take(4)
            for (ia, ta), (ib, tb) in zip(batches_a, batches_b):
                self.assertTrue(np.array_equal(ia, ib))
                self.assertTrue(np.array_equal(ta, tb))


class JSONLSourceTests(unittest.TestCase):
    def test_jsonl_source_drops_malformed_lines(self) -> None:
        with tempfile.TemporaryDirectory() as out_dir:
            path = Path(out_dir) / "docs.jsonl"
            payload = (
                '{"text": "良い document 1"}\n'
                "まったく JSON ではない\n"
                '{"other": "missing text"}\n'
                '{"text": "良い document 2"}\n'
            )
            path.write_text(payload, encoding="utf-8")
            source = JSONLSource(path)
            collected = list(source)
            self.assertEqual(collected, ["良い document 1", "良い document 2"])
            self.assertEqual(source.dropped_lines, 2)


class PackDocumentsTests(unittest.TestCase):
    def test_pack_documents_yields_fixed_length_groups(self) -> None:
        tokenizer = Tokenizer()
        docs = ["alpha bravo", "charlie delta echo", "foxtrot"]
        groups = list(pack_documents(tokenizer, docs, max_tokens=8))
        for group in groups[:-1]:
            self.assertEqual(len(group), 8)
        self.assertGreater(len(groups), 0)

    def test_pack_documents_injects_boundary_between_documents(self) -> None:
        tokenizer = Tokenizer()
        groups = list(pack_documents(tokenizer, ["a", "b"], max_tokens=8))
        joined = [token for group in groups for token in group]
        self.assertIn(BOUNDARY_TOKEN_ID, joined)


if __name__ == "__main__":
    unittest.main()
