"""Streaming tokenization into resizable, sharded HDF5 datasets with mmap reads.

Implements:
- A byte-level deterministic Tokenizer.
- An HDF5ShardWriter that buffers tokens to chunk size and resizes the dataset
  in fixed-size strides, recording token_count and sha256 as dataset attributes.
- A ShardedTokenizationPipeline that emits one HDF5 per source shard and writes
  a shards.json index.
- An MmapTokenStore that opens shard files in swmr mode for read access.
- A SlidingWindowDataloader that yields fixed-length (input, target) pairs.

The demo at the bottom builds an in-memory corpus, tokenizes into shards, opens
them via memory map, runs the dataloader for a few batches, and prints the
per-batch shape and a checksum. Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
import random
import struct
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

import numpy as np

try:
    import h5py
except ImportError as exc:
    raise SystemExit(
        "h5py is required for this lesson. Install with: pip install h5py"
    ) from exc


DEFAULT_CHUNK_SIZE = 8192
DEFAULT_WINDOW_SIZE = 64
BOUNDARY_TOKEN_ID = 0
TOKEN_DTYPE = np.uint16


@dataclass
class ShardWriteResult:
    """Per-shard write outcome."""

    shard_id: str
    path: str
    token_count: int
    document_count: int
    chunk_size: int
    sha256: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class ShardIndexEntry:
    """Index row used by readers to locate a shard."""

    shard_id: str
    path: str
    token_count: int
    document_count: int
    sha256: str
    global_start: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


class Tokenizer:
    """Byte-level deterministic tokenizer.

    Vocabulary:
        0      boundary token (separator injected by the dataloader)
        1..256 raw byte tokens (offset by one so 0 is reserved)

    Real tokenizers use BPE or SentencePiece; this implementation is enough to
    drive the streaming-write story without pulling a third-party tokenizer.
    """

    BOUNDARY_TOKEN = BOUNDARY_TOKEN_ID
    BYTE_OFFSET = 1

    def __init__(self) -> None:
        self.vocab_size = 257

    def encode(self, text: str) -> list[int]:
        if not text:
            return []
        data = text.encode("utf-8")
        return [self.BYTE_OFFSET + b for b in data]

    def decode(self, ids: Iterable[int]) -> str:
        byte_ids = [int(i) - self.BYTE_OFFSET for i in ids if int(i) >= self.BYTE_OFFSET]
        return bytes(byte_ids).decode("utf-8", errors="replace")


class HDF5ShardWriter:
    """Stream tokens into a resizable HDF5 dataset with chunk-sized buffering.

    Open in a `with` block to guarantee the residual buffer is flushed and the
    closing attributes (token_count, sha256) are written.
    """

    def __init__(
        self,
        path: Path,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        dataset_name: str = "tokens",
    ) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        self.path = Path(path)
        self.chunk_size = chunk_size
        self.dataset_name = dataset_name
        self._buffer: list[int] = []
        self._token_count = 0
        self._document_count = 0
        self._hasher = hashlib.sha256()
        self._file: h5py.File | None = None
        self._dataset: h5py.Dataset | None = None

    def __enter__(self) -> "HDF5ShardWriter":
        self._file = h5py.File(self.path, "w", libver="latest")
        self._dataset = self._file.create_dataset(
            self.dataset_name,
            shape=(0,),
            maxshape=(None,),
            chunks=(self.chunk_size,),
            dtype=TOKEN_DTYPE,
        )
        self._file.swmr_mode = True
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if self._dataset is not None and self._file is not None:
                if self._buffer:
                    self._flush_buffer(final=True)
                self._dataset.attrs["token_count"] = self._token_count
                self._dataset.attrs["document_count"] = self._document_count
                self._dataset.attrs["sha256"] = self._hasher.hexdigest()
        finally:
            if self._file is not None:
                self._file.close()
                self._file = None
                self._dataset = None

    def add_document(self, token_ids: Iterable[int]) -> None:
        self._document_count += 1
        for token in token_ids:
            self._buffer.append(int(token))
            if len(self._buffer) >= self.chunk_size:
                self._flush_buffer(final=False)

    def add_boundary(self) -> None:
        """Inject the separator token between documents."""

        self._buffer.append(BOUNDARY_TOKEN_ID)
        if len(self._buffer) >= self.chunk_size:
            self._flush_buffer(final=False)

    def _flush_buffer(self, final: bool) -> None:
        if self._dataset is None:
            raise RuntimeError("writer is not open")
        if not self._buffer:
            return
        size = len(self._buffer) if final else self.chunk_size
        chunk = np.asarray(self._buffer[:size], dtype=TOKEN_DTYPE)
        new_total = self._token_count + size
        self._dataset.resize((new_total,))
        self._dataset[self._token_count : new_total] = chunk
        self._dataset.flush()
        self._hasher.update(chunk.tobytes())
        self._token_count = new_total
        self._buffer = self._buffer[size:]
        if not final and len(self._buffer) >= self.chunk_size:
            self._flush_buffer(final=False)

    @property
    def token_count(self) -> int:
        return self._token_count

    @property
    def document_count(self) -> int:
        return self._document_count

    def result(self, shard_id: str) -> ShardWriteResult:
        return ShardWriteResult(
            shard_id=shard_id,
            path=str(self.path),
            token_count=self._token_count,
            document_count=self._document_count,
            chunk_size=self.chunk_size,
            sha256=self._hasher.hexdigest(),
        )


class ShardedTokenizationPipeline:
    """Tokenize iterable shard inputs into HDF5 files and write a shards.json."""

    def __init__(
        self,
        tokenizer: Tokenizer,
        output_dir: Path,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
    ) -> None:
        self.tokenizer = tokenizer
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.chunk_size = chunk_size

    def write_shard(self, shard_id: str, documents: Iterable[str]) -> ShardWriteResult:
        shard_path = self.output_dir / f"{shard_id}.h5"
        writer = HDF5ShardWriter(shard_path, chunk_size=self.chunk_size)
        with writer:
            for text in documents:
                writer.add_document(self.tokenizer.encode(text))
                writer.add_boundary()
        return writer.result(shard_id)

    def write_corpus(self, shards: dict[str, Iterable[str]]) -> list[ShardIndexEntry]:
        entries: list[ShardIndexEntry] = []
        running_offset = 0
        for shard_id, documents in shards.items():
            result = self.write_shard(shard_id, documents)
            entries.append(
                ShardIndexEntry(
                    shard_id=result.shard_id,
                    path=result.path,
                    token_count=result.token_count,
                    document_count=result.document_count,
                    sha256=result.sha256,
                    global_start=running_offset,
                )
            )
            running_offset += result.token_count
        index_path = self.output_dir / "shards.json"
        body = {
            "version": 1,
            "chunk_size": self.chunk_size,
            "total_tokens": running_offset,
            "shards": [entry.to_dict() for entry in entries],
        }
        index_path.write_text(json.dumps(body, sort_keys=True, indent=2), encoding="utf-8")
        return entries


class MmapTokenStore:
    """Memory-mapped read access to a sharded HDF5 token corpus.

    The store opens each shard file once in SWMR mode. A request for
    `get_slice(start, stop)` is routed across shards and the result is returned
    as a flat NumPy uint16 array. Reads land in the page cache; the dataloader
    pays one copy when it crosses into a training tensor.
    """

    def __init__(self, shard_entries: list[ShardIndexEntry]) -> None:
        if not shard_entries:
            raise ValueError("at least one shard entry is required")
        self._entries = shard_entries
        self._files: list[h5py.File] = []
        self._datasets: list[h5py.Dataset] = []
        try:
            for entry in shard_entries:
                self._files.append(h5py.File(entry.path, "r", swmr=True))
            self._datasets = [f["tokens"] for f in self._files]
        except Exception:
            for opened in self._files:
                try:
                    opened.close()
                except Exception:
                    pass
            self._files = []
            self._datasets = []
            raise
        self._total_tokens = sum(entry.token_count for entry in shard_entries)

    @property
    def total_tokens(self) -> int:
        return self._total_tokens

    def close(self) -> None:
        for file in self._files:
            try:
                file.close()
            except Exception:
                pass
        self._files = []
        self._datasets = []

    def __enter__(self) -> "MmapTokenStore":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def get_slice(self, start: int, stop: int) -> np.ndarray:
        if start < 0 or stop < 0 or stop < start:
            raise ValueError(f"bad slice: start={start} stop={stop}")
        if stop > self._total_tokens:
            raise ValueError(f"stop ({stop}) exceeds total tokens ({self._total_tokens})")
        if stop == start:
            return np.empty((0,), dtype=TOKEN_DTYPE)
        out = np.empty((stop - start,), dtype=TOKEN_DTYPE)
        cursor = 0
        for entry, dataset in zip(self._entries, self._datasets):
            shard_start = entry.global_start
            shard_stop = shard_start + entry.token_count
            if stop <= shard_start:
                break
            if start >= shard_stop:
                continue
            local_start = max(0, start - shard_start)
            local_stop = min(entry.token_count, stop - shard_start)
            length = local_stop - local_start
            if length <= 0:
                continue
            out[cursor : cursor + length] = dataset[local_start:local_stop]
            cursor += length
        if cursor != stop - start:
            raise RuntimeError(
                f"slice read produced {cursor} tokens, expected {stop - start}"
            )
        return out


class SlidingWindowDataloader:
    """Random sliding-window sampler over a flat token stream."""

    def __init__(
        self,
        store: MmapTokenStore,
        window_size: int = DEFAULT_WINDOW_SIZE,
        batch_size: int = 4,
        seed: int = 0,
    ) -> None:
        if window_size <= 1:
            raise ValueError("window_size must be greater than 1")
        if batch_size <= 0:
            raise ValueError("batch_size must be positive")
        if store.total_tokens <= window_size:
            raise ValueError(
                f"store has only {store.total_tokens} tokens; need more than {window_size}"
            )
        self.store = store
        self.window_size = window_size
        self.batch_size = batch_size
        self._random = random.Random(seed)
        self._max_start = store.total_tokens - window_size - 1

    def _sample_window(self) -> tuple[np.ndarray, np.ndarray]:
        start = self._random.randint(0, self._max_start)
        chunk = self.store.get_slice(start, start + self.window_size + 1)
        return chunk[:-1], chunk[1:]

    def __iter__(self) -> Iterator[tuple[np.ndarray, np.ndarray]]:
        while True:
            inputs = np.empty((self.batch_size, self.window_size), dtype=TOKEN_DTYPE)
            targets = np.empty((self.batch_size, self.window_size), dtype=TOKEN_DTYPE)
            for row in range(self.batch_size):
                inputs[row], targets[row] = self._sample_window()
            yield inputs, targets

    def take(self, num_batches: int) -> list[tuple[np.ndarray, np.ndarray]]:
        iterator = iter(self)
        return [next(iterator) for _ in range(num_batches)]


class JSONLSource:
    """Adapter that yields documents from a JSONL file with a configurable key.

    The downloader (Phase 19 · 42) emits JSONL where each line is a JSON object
    with a `text` field. This adapter pulls the text out and skips lines that
    are malformed or missing the field. Real pipelines log the dropped lines;
    this adapter counts them so callers can audit dropout rate.
    """

    def __init__(self, path: Path, text_field: str = "text") -> None:
        self.path = Path(path)
        self.text_field = text_field
        self.dropped_lines = 0

    def __iter__(self) -> Iterator[str]:
        with self.path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.rstrip("\n")
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    self.dropped_lines += 1
                    continue
                if not isinstance(record, dict):
                    self.dropped_lines += 1
                    continue
                value = record.get(self.text_field)
                if not isinstance(value, str) or not value:
                    self.dropped_lines += 1
                    continue
                yield value


def pack_documents(
    tokenizer: Tokenizer,
    documents: Iterable[str],
    max_tokens: int,
) -> Iterator[list[int]]:
    """Pack tokenized documents into fixed-length groups with boundary tokens.

    Yields lists of exactly max_tokens token ids. Long documents are split
    across groups; short documents share a group separated by BOUNDARY_TOKEN_ID.
    The final group may be shorter than max_tokens and is yielded as-is.
    """

    if max_tokens <= 1:
        raise ValueError("max_tokens must be greater than 1")
    buffer: list[int] = []
    for text in documents:
        token_ids = tokenizer.encode(text)
        if buffer:
            buffer.append(BOUNDARY_TOKEN_ID)
        buffer.extend(token_ids)
        while len(buffer) >= max_tokens:
            yield buffer[:max_tokens]
            buffer = buffer[max_tokens:]
    if buffer:
        yield buffer


def tokenize_jsonl_path(
    jsonl_path: Path,
    output_dir: Path,
    shard_id: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    text_field: str = "text",
) -> ShardWriteResult:
    """Convenience wrapper: tokenize one JSONL file into one HDF5 shard."""

    tokenizer = Tokenizer()
    pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=output_dir, chunk_size=chunk_size)
    source = JSONLSource(jsonl_path, text_field=text_field)
    return pipeline.write_shard(shard_id, source)


def load_index(index_path: Path) -> list[ShardIndexEntry]:
    """Read shards.json and return ShardIndexEntry rows."""

    data = json.loads(Path(index_path).read_text("utf-8"))
    entries: list[ShardIndexEntry] = []
    for row in data["shards"]:
        entries.append(
            ShardIndexEntry(
                shard_id=str(row["shard_id"]),
                path=str(row["path"]),
                token_count=int(row["token_count"]),
                document_count=int(row.get("document_count", 0)),
                sha256=str(row["sha256"]),
                global_start=int(row["global_start"]),
            )
        )
    return entries


def validate_corpus(index_entries: list[ShardIndexEntry]) -> list[str]:
    """Recompute each shard's sha256 over its on-disk tokens and report mismatches."""

    failures: list[str] = []
    for entry in index_entries:
        with h5py.File(entry.path, "r", swmr=True) as fh:
            dataset = fh["tokens"]
            recorded_count = int(dataset.attrs.get("token_count", entry.token_count))
            tokens = np.asarray(dataset[:recorded_count], dtype=TOKEN_DTYPE)
            recomputed = hashlib.sha256(tokens.tobytes()).hexdigest()
            if recomputed != entry.sha256:
                failures.append(entry.shard_id)
    return failures


def build_demo_corpus() -> dict[str, list[str]]:
    """Two shards of synthetic documents long enough to exercise mmap reads."""

    base = [
        "the alignment problem is a story about reward functions and the things they fail to write down",
        "attention scales better with sequence length so transformers replaced recurrent networks during the language modeling era",
        "an evaluation harness keeps training honest by treating the test corpus as a contract that cannot drift",
        "deduplication is upstream of tokenization because every duplicate token costs the trainer twice in compute",
        "checkpoints record the optimizer state and the random seed so that a restart resumes exactly where it stopped",
    ]
    long_repeat = " ".join(base * 4)
    shards: dict[str, list[str]] = {
        "shard-0000": [long_repeat, long_repeat, long_repeat],
        "shard-0001": [long_repeat, long_repeat, long_repeat],
    }
    return shards


def run_demo() -> int:
    """Build a demo corpus, tokenize it, validate it, and run the dataloader.

    Designed to be self-terminating: the pipeline writes into a temporary
    directory and the dataloader takes a small fixed number of batches so the
    script exits without external input.
    """

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        tokenizer = Tokenizer()
        pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=out, chunk_size=512)
        shards = build_demo_corpus()
        entries = pipeline.write_corpus(shards)
        for entry in entries:
            print(
                f"[shard] {entry.shard_id} tokens={entry.token_count} "
                f"sha256={entry.sha256[:12]} global_start={entry.global_start}"
            )
        validation_failures = validate_corpus(entries)
        if validation_failures:
            print(f"[validate] failed: {validation_failures}")
            return 1
        print(f"[validate] all {len(entries)} shards match recorded sha256")
        with MmapTokenStore(entries) as store:
            loader = SlidingWindowDataloader(store, window_size=64, batch_size=4, seed=7)
            for batch_index, (inputs, targets) in enumerate(loader.take(10)):
                checksum = int(hashlib.blake2b(inputs.tobytes(), digest_size=4).hexdigest(), 16)
                print(
                    f"[batch] step={batch_index} shape={tuple(inputs.shape)} "
                    f"checksum={checksum:08x}"
                )
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
