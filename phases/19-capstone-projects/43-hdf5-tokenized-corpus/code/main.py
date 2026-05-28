"""mmap read 可能な resizable/sharded HDF5 dataset への streaming tokenization。

実装内容:
- byte-level deterministic Tokenizer。
- token を chunk size まで buffer し dataset を resize する HDF5ShardWriter。
  fixed-size stride で伸ばし、token_count と sha256 を dataset attribute に記録する。
- source shard ごとに HDF5 を 1 つ出し、
  shards.json index を書く ShardedTokenizationPipeline。
- read access 用に shard file を swmr mode で開く MmapTokenStore。
- fixed-length の (input, target) pair を返す SlidingWindowDataloader。

末尾の demo は in-memory corpus を作り、shard に token 化し、
memory map 経由で開き、dataloader を数 batch 実行し、
batch ごとの shape と checksum を表示する。実行: python3 code/main.py
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
        "この lesson には h5py が必要です。Install: pip install h5py"
    ) from exc


DEFAULT_CHUNK_SIZE = 8192
DEFAULT_WINDOW_SIZE = 64
BOUNDARY_TOKEN_ID = 0
TOKEN_DTYPE = np.uint16


@dataclass
class ShardWriteResult:
    """shard ごとの write 結果。"""

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
    """reader が shard を見つけるための index row。"""

    shard_id: str
    path: str
    token_count: int
    document_count: int
    sha256: str
    global_start: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


class Tokenizer:
    """Byte-level deterministic tokenizer。

    Vocabulary:
        0      boundary token (dataloader が注入する separator)
        1..256 raw byte token (0 を予約するため 1 offset)

    実際の tokenizer は BPE や SentencePiece を使う。この実装は
    third-party tokenizer なしで streaming write の流れを示すのに十分である。
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
    """chunk-sized buffering で resizable HDF5 dataset に token を stream する。

    residual buffer の flush と closing attribute の書き込みを保証するため `with` block で開く。

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
        """document 間に separator token を注入する。"""

        self._buffer.append(BOUNDARY_TOKEN_ID)
        if len(self._buffer) >= self.chunk_size:
            self._flush_buffer(final=False)

    def _flush_buffer(self, final: bool) -> None:
        if self._dataset is None:
            raise RuntimeError("writer が open されていません")
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
    """iterable shard input を HDF5 file に token 化し、shards.json を書く。"""

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
    """sharded HDF5 token corpus への memory-mapped read access。

    store は各 shard file を SWMR mode で 1 回開く。
    `get_slice(start, stop)` is routed across shards and the result is returned
    as a flat NumPy uint16 array. Reads land in the page cache; the dataloader
    pays one copy when it crosses into a training tensor.
    """

    def __init__(self, shard_entries: list[ShardIndexEntry]) -> None:
        if not shard_entries:
            raise ValueError("少なくとも 1 つの shard entry が必要です")
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
            raise ValueError(f"不正な slice: start={start} stop={stop}")
        if stop > self._total_tokens:
            raise ValueError(f"stop ({stop}) が total tokens を超えています ({self._total_tokens})")
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
    """flat token stream 上の random sliding-window sampler。"""

    def __init__(
        self,
        store: MmapTokenStore,
        window_size: int = DEFAULT_WINDOW_SIZE,
        batch_size: int = 4,
        seed: int = 0,
    ) -> None:
        if window_size <= 1:
            raise ValueError("window_size は 1 より大きい必要があります")
        if batch_size <= 0:
            raise ValueError("batch_size は正でなければなりません")
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
    """configurable key で JSONL file から document を返す adapter。

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
    """tokenized document を boundary token 付き fixed-length group に pack する。

    ちょうど max_tokens 個の token id list を返す。長い document は分割される。 split
    across groups; short documents share a group separated by BOUNDARY_TOKEN_ID.
    The final group may be shorter than max_tokens and is yielded as-is.
    """

    if max_tokens <= 1:
        raise ValueError("max_tokens は 1 より大きい必要があります")
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
    """便利 wrapper: 1 つの JSONL file を 1 つの HDF5 shard に token 化する。"""

    tokenizer = Tokenizer()
    pipeline = ShardedTokenizationPipeline(tokenizer, output_dir=output_dir, chunk_size=chunk_size)
    source = JSONLSource(jsonl_path, text_field=text_field)
    return pipeline.write_shard(shard_id, source)


def load_index(index_path: Path) -> list[ShardIndexEntry]:
    """shards.json を読み ShardIndexEntry row を返す。"""

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
    """各 shard の on-disk token から sha256 を再計算し、不一致を報告する。"""

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
    """mmap read を動かすのに十分な長さの synthetic document 2 shard。"""

    base = [
        "alignment problem は reward function についての話である and the things they fail to write down",
        "attention は sequence length に対してよりよく scale するため transformer は recurrent network を置き換えた during the language modeling era",
        "evaluation harness は drift できない contract として test corpus を扱い training を正直に保つ",
        "deduplication は tokenization の upstream にある。duplicate token は trainer に compute を 2 回払わせるからである",
        "checkpoint は optimizer state と random seed を記録し、restart が停止位置から正確に再開できるようにする",
    ]
    long_repeat = " ".join(base * 4)
    shards: dict[str, list[str]] = {
        "shard-0000": [long_repeat, long_repeat, long_repeat],
        "shard-0001": [long_repeat, long_repeat, long_repeat],
    }
    return shards


def run_demo() -> int:
    """demo corpus を作り、tokenize、validate し、dataloader を実行する。

    self-terminating に設計されている。pipeline は temp に書く。orary
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
            print(f"[validate] が失敗しました: {validation_failures}")
            return 1
        print(f"[validate] 全 {len(entries)} shard が記録 sha256 と一致しました")
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
