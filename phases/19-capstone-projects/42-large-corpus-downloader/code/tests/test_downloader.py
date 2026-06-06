"""Unit tests for the streaming corpus downloader.

Run with: python3 -m unittest discover code/tests -v
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import zstandard as zstd

from main import (
    CHUNK_BYTES,
    CheckpointState,
    Dedup,
    DocVerdict,
    LSHIndex,
    ManifestWriter,
    MinHasher,
    ShardPlan,
    ShardPlanner,
    ShardResult,
    StreamingDownloader,
    ZstdDocIterator,
    build_demo_corpus,
    process_shard,
)


def _zst_url(directory: Path, name: str, lines: list[str]) -> str:
    payload = ("\n".join(lines) + "\n").encode("utf-8")
    compressed = zstd.ZstdCompressor(level=10).compress(payload)
    path = directory / f"{name}.zst"
    path.write_bytes(compressed)
    return path.as_uri()


class MinHasherTests(unittest.TestCase):
    def test_signature_length_matches_num_hashes(self) -> None:
        hasher = MinHasher(num_hashes=64, shingle_width=3)
        sig = hasher.signature("the quick brown fox jumps over the lazy dog")
        self.assertEqual(len(sig), 64)

    def test_identical_text_produces_identical_signature(self) -> None:
        hasher = MinHasher(num_hashes=32, shingle_width=3)
        text = "alignment is a contract between rewards and behavior"
        self.assertEqual(hasher.signature(text), hasher.signature(text))

    def test_near_duplicate_has_high_jaccard_estimate(self) -> None:
        hasher = MinHasher(num_hashes=256, shingle_width=3)
        index = LSHIndex(num_hashes=256, bands=64)
        a = "alignment is a contract between reward functions and behavior"
        b = "alignment is a contract between reward functions and the behavior"
        index.insert("a", hasher.signature(a))
        index.insert("b", hasher.signature(b))
        estimate = index.jaccard_estimate("a", "b")
        self.assertGreater(estimate, 0.5)

    def test_empty_text_yields_sentinel_signature(self) -> None:
        hasher = MinHasher(num_hashes=16, shingle_width=3)
        sig = hasher.signature("")
        self.assertEqual(len(sig), 16)
        self.assertTrue(all(value > 0 for value in sig))

    def test_rejects_bad_arguments(self) -> None:
        with self.assertRaises(ValueError):
            MinHasher(num_hashes=0)
        with self.assertRaises(ValueError):
            MinHasher(num_hashes=8, shingle_width=0)


class LSHIndexTests(unittest.TestCase):
    def test_band_count_must_divide_num_hashes(self) -> None:
        with self.assertRaises(ValueError):
            LSHIndex(num_hashes=10, bands=3)

    def test_lsh_catches_high_similarity_pair(self) -> None:
        hasher = MinHasher(num_hashes=128, shingle_width=3)
        index = LSHIndex(num_hashes=128, bands=32)
        keeper_text = (
            "transformers replaced recurrent networks because attention scales "
            "better with sequence length and parallelizes across positions"
        )
        near_dup = (
            "transformers replaced recurrent networks because attention scales "
            "better with sequence length and parallelizes across token positions"
        )
        index.insert("keeper", hasher.signature(keeper_text))
        match = index.query(hasher.signature(near_dup))
        self.assertEqual(match, "keeper")

    def test_lsh_does_not_collide_unrelated_documents(self) -> None:
        hasher = MinHasher(num_hashes=128, shingle_width=3)
        index = LSHIndex(num_hashes=128, bands=32)
        index.insert("alpha", hasher.signature("the alignment problem is a story about reward functions"))
        match = index.query(
            hasher.signature("kubernetes pod scheduling is a constraint satisfaction problem")
        )
        self.assertIsNone(match)


class DedupTests(unittest.TestCase):
    def test_dedup_keeps_first_and_drops_second(self) -> None:
        hasher = MinHasher(num_hashes=128, shingle_width=3)
        index = LSHIndex(num_hashes=128, bands=32)
        dedup = Dedup(hasher=hasher, index=index)
        verdict_keep = dedup.evaluate("s0", 0, "the alignment problem is a story about reward functions")
        verdict_dup = dedup.evaluate(
            "s0", 1, "the alignment problem is a story about reward functions"
        )
        self.assertEqual(verdict_keep.verdict, "keep")
        self.assertEqual(verdict_dup.verdict, "near_duplicate")
        self.assertEqual(verdict_dup.collided_with, "s0:0")


class CheckpointTests(unittest.TestCase):
    def test_checkpoint_round_trips_through_json(self) -> None:
        state = CheckpointState(
            url="file:///tmp/x.zst",
            verified_bytes=42,
            expected_size=200,
            sha256_prefix_hex="abc",
        )
        rebuilt = CheckpointState.from_json(state.to_json())
        self.assertEqual(rebuilt, state)


class ShardPlannerTests(unittest.TestCase):
    def test_planner_assigns_zero_padded_ids(self) -> None:
        plans = ShardPlanner.from_urls(["file:///a", "file:///b", "file:///c"])
        self.assertEqual([p.shard_id for p in plans], ["shard-0000", "shard-0001", "shard-0002"])


class DownloaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp_corpus = tempfile.TemporaryDirectory()
        self._tmp_cache = tempfile.TemporaryDirectory()
        self.corpus_dir = Path(self._tmp_corpus.name)
        self.cache_dir = Path(self._tmp_cache.name)

    def tearDown(self) -> None:
        self._tmp_corpus.cleanup()
        self._tmp_cache.cleanup()

    def test_download_writes_shard_and_checkpoint(self) -> None:
        url = _zst_url(self.corpus_dir, "one", ["alpha", "beta", "gamma"])
        downloader = StreamingDownloader(cache_dir=self.cache_dir)
        plan = ShardPlan(shard_id="shard-0000", url=url)
        result = downloader.download(plan)
        shard_path = self.cache_dir / "shard-0000.zst"
        checkpoint_path = self.cache_dir / "shard-0000.partial.json"
        self.assertTrue(shard_path.exists())
        self.assertTrue(checkpoint_path.exists())
        self.assertEqual(result.document_count, 3)

    def test_resume_after_corruption_restarts(self) -> None:
        url = _zst_url(self.corpus_dir, "two", ["one", "two", "three"])
        downloader = StreamingDownloader(cache_dir=self.cache_dir)
        plan = ShardPlan(shard_id="shard-0001", url=url)
        downloader.download(plan)
        checkpoint_path = self.cache_dir / "shard-0001.partial.json"
        state = CheckpointState.from_json(checkpoint_path.read_text("utf-8"))
        corrupted = CheckpointState(
            url=state.url,
            verified_bytes=state.verified_bytes,
            expected_size=state.expected_size,
            sha256_prefix_hex="0" * 64,
        )
        checkpoint_path.write_text(corrupted.to_json(), encoding="utf-8")
        result_after = downloader.download(plan)
        self.assertEqual(result_after.document_count, 3)


class ManifestTests(unittest.TestCase):
    def test_manifest_writer_emits_a_lock_and_records_hash(self) -> None:
        manifest = ManifestWriter()
        manifest.add_shard(
            ShardResult(
                shard_id="shard-0000",
                url="file:///tmp",
                raw_bytes=1024,
                decompressed_bytes=4096,
                document_count=10,
                kept_count=9,
                duplicate_count=1,
                sha256="deadbeef",
            )
        )
        manifest.add_verdict(DocVerdict(shard_id="shard-0000", doc_index=0, verdict="keep"))
        with tempfile.TemporaryDirectory() as out:
            manifest_path = Path(out) / "manifest.json"
            manifest_sha = manifest.write(manifest_path)
            lock_path = manifest_path.with_suffix(".json.lock")
            self.assertTrue(lock_path.exists())
            self.assertEqual(json.loads(lock_path.read_text("utf-8"))["manifest_sha256"], manifest_sha)


class IntegrationTests(unittest.TestCase):
    def test_end_to_end_dedup_via_demo_corpus(self) -> None:
        with tempfile.TemporaryDirectory() as raw, tempfile.TemporaryDirectory() as cache:
            corpus_dir = Path(raw)
            cache_dir = Path(cache)
            urls = build_demo_corpus(corpus_dir)
            self.assertGreater(len(urls), 1)
            plans = ShardPlanner.from_urls(urls)
            downloader = StreamingDownloader(cache_dir=cache_dir)
            hasher = MinHasher(num_hashes=128, shingle_width=3)
            index = LSHIndex(num_hashes=128, bands=32)
            dedup = Dedup(hasher=hasher, index=index)
            manifest = ManifestWriter()
            total_docs = 0
            total_kept = 0
            for plan in plans:
                result = process_shard(plan, downloader, dedup, manifest)
                total_docs += result.document_count
                total_kept += result.kept_count
            self.assertGreater(total_docs, total_kept)


if __name__ == "__main__":
    unittest.main()
