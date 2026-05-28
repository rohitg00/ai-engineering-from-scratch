"""resume、MinHash + LSH dedup、shard manifest を持つ streaming corpus downloader。

URL list から compressed shard を取得し、Zstandard で stream 展開し、JSONL document を走査する。各 document に MinHash fingerprint を付け、LSH bucket で near-duplicate を落とし、corpus manifest を書く。

末尾の demo は小さな synthetic corpus を disk に作り、Zstandard で圧縮し、file URL としてこの module で download して manifest を表示する。実行: python3 code/main.py
"""

from __future__ import annotations

import dataclasses
import hashlib
import io
import json
import os
import struct
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Iterator

try:
    import zstandard as zstd
except ImportError as exc:
    raise SystemExit(
        "この lesson には zstandard が必要です。Install: pip install zstandard"
    ) from exc


CHUNK_BYTES = 1 << 16
DEFAULT_NUM_HASHES = 128
DEFAULT_BANDS = 32
DEFAULT_SHINGLE_WIDTH = 5
MAX_UINT64 = (1 << 64) - 1
MERSENNE_PRIME = (1 << 61) - 1


@dataclass
class ShardPlan:
    """planned shard list の 1 行。"""

    shard_id: str
    url: str
    expected_size: int | None = None


@dataclass
class ShardResult:
    """shard ごとの download と dedup 結果。"""

    shard_id: str
    url: str
    raw_bytes: int
    decompressed_bytes: int
    document_count: int
    kept_count: int
    duplicate_count: int
    sha256: str

    def to_manifest_row(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class DocVerdict:
    """1 document の dedup verdict。"""

    shard_id: str
    doc_index: int
    verdict: str  # "keep" or "near_duplicate"
    collided_with: str | None = None  # "shard:doc" of the keeper


@dataclass
class CheckpointState:
    """shard の横に永続化する resume checkpoint。"""

    url: str
    verified_bytes: int
    expected_size: int | None
    sha256_prefix_hex: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), sort_keys=True)

    @classmethod
    def from_json(cls, text: str) -> "CheckpointState":
        data = json.loads(text)
        return cls(
            url=str(data["url"]),
            verified_bytes=int(data["verified_bytes"]),
            expected_size=(int(data["expected_size"]) if data.get("expected_size") is not None else None),
            sha256_prefix_hex=str(data["sha256_prefix_hex"]),
        )


def _hash_seed_pair(seed: int) -> tuple[int, int]:
    """seed から 2 つの 64-bit coefficient (a, b) を導出する。

    signature は ((a * x + b) mod p) mod 2^64 形式の universal hashing を使う。
    2 つの coefficient は seed から deterministic に導出されるため、hash family は run と machine をまたいで再現できる。
    """

    digest = hashlib.blake2b(seed.to_bytes(8, "little"), digest_size=16).digest()
    a = int.from_bytes(digest[:8], "little") | 1  # ensure a is non-zero
    b = int.from_bytes(digest[8:], "little")
    return a, b


class MinHasher:
    """固定 hash seed 群を使う MinHash signature builder。"""

    def __init__(self, num_hashes: int = DEFAULT_NUM_HASHES, shingle_width: int = DEFAULT_SHINGLE_WIDTH) -> None:
        if num_hashes <= 0:
            raise ValueError("num_hashes は正でなければなりません")
        if shingle_width <= 0:
            raise ValueError("shingle_width は正でなければなりません")
        self.num_hashes = num_hashes
        self.shingle_width = shingle_width
        self._coefficients: list[tuple[int, int]] = [_hash_seed_pair(i) for i in range(num_hashes)]

    def shingles(self, text: str) -> list[str]:
        """overlap する whitespace-token shingle を返す。"""

        tokens = text.split()
        if len(tokens) < self.shingle_width:
            return [" ".join(tokens)] if tokens else []
        shingles: list[str] = []
        for start in range(len(tokens) - self.shingle_width + 1):
            shingles.append(" ".join(tokens[start : start + self.shingle_width]))
        return shingles

    @staticmethod
    def _hash_shingle(shingle: str) -> int:
        digest = hashlib.blake2b(shingle.encode("utf-8"), digest_size=8).digest()
        return int.from_bytes(digest, "little")

    def signature(self, text: str) -> list[int]:
        """num_hashes 個の 64-bit int list として MinHash signature を返す。"""

        shingles = self.shingles(text)
        if not shingles:
            return [MAX_UINT64] * self.num_hashes
        shingle_hashes = [self._hash_shingle(s) for s in shingles]
        sig: list[int] = []
        for a, b in self._coefficients:
            best = MAX_UINT64
            for h in shingle_hashes:
                candidate = ((a * h + b) % MERSENNE_PRIME) & MAX_UINT64
                if candidate < best:
                    best = candidate
            sig.append(best)
        return sig


class LSHIndex:
    """MinHash signature 上の locality-sensitive hashing index。

    各 signature を `rows = num_hashes / bands` 行の `bands` 個に分割する。
    少なくとも 1 つの band が一致すれば 2 つの signature は collide する。
    確率は Jaccard similarity を s として 1 - (1 - s^r)^b である。
    これにより s = (1/b)^(1/r) 付近に sharp threshold ができる。
    (b=32, r=4) では約 0.42、(b=20, r=5) では約 0.55 である。
    """

    def __init__(self, num_hashes: int, bands: int = DEFAULT_BANDS) -> None:
        if bands <= 0 or num_hashes % bands != 0:
            raise ValueError(f"bands ({bands}) must divide num_hashes ({num_hashes})")
        self.num_hashes = num_hashes
        self.bands = bands
        self.rows = num_hashes // bands
        self._buckets: list[dict[bytes, list[str]]] = [{} for _ in range(bands)]
        self._signatures: dict[str, list[int]] = {}

    @staticmethod
    def _band_key(band: list[int]) -> bytes:
        return hashlib.blake2b(b"".join(struct.pack("<Q", v) for v in band), digest_size=16).digest()

    def query(self, signature: list[int]) -> str | None:
        """near-duplicate keeper の doc id、または None を返す。"""

        for i in range(self.bands):
            band = signature[i * self.rows : (i + 1) * self.rows]
            key = self._band_key(band)
            bucket = self._buckets[i].get(key)
            if bucket:
                return bucket[0]
        return None

    def insert(self, doc_id: str, signature: list[int]) -> None:
        self._signatures[doc_id] = signature
        for i in range(self.bands):
            band = signature[i * self.rows : (i + 1) * self.rows]
            key = self._band_key(band)
            self._buckets[i].setdefault(key, []).append(doc_id)

    def jaccard_estimate(self, doc_a: str, doc_b: str) -> float:
        """index 済み 2 document 間の unbiased Jaccard estimate を返す。"""

        sig_a = self._signatures[doc_a]
        sig_b = self._signatures[doc_b]
        agree = sum(1 for a, b in zip(sig_a, sig_b) if a == b)
        return agree / self.num_hashes


class Dedup:
    """MinHasher と LSHIndex を組み合わせた streaming dedup。"""

    def __init__(self, hasher: MinHasher, index: LSHIndex) -> None:
        self.hasher = hasher
        self.index = index

    def evaluate(self, shard_id: str, doc_index: int, text: str) -> DocVerdict:
        sig = self.hasher.signature(text)
        keeper = self.index.query(sig)
        if keeper is not None:
            return DocVerdict(
                shard_id=shard_id,
                doc_index=doc_index,
                verdict="near_duplicate",
                collided_with=keeper,
            )
        doc_id = f"{shard_id}:{doc_index}"
        self.index.insert(doc_id, sig)
        return DocVerdict(shard_id=shard_id, doc_index=doc_index, verdict="keep")


class ZstdDocIterator:
    """Zstandard-compressed byte stream から JSONL document を反復する。

    upstream reader を Zstandard stream reader で包み、1 行ずつ反復する。
    line per document. The decompressor never buffers the whole shard; it
    consumes the upstream incrementally.
    """

    def __init__(self, raw_reader: io.RawIOBase | io.BufferedIOBase) -> None:
        self._dctx = zstd.ZstdDecompressor()
        self._stream = self._dctx.stream_reader(raw_reader)
        self._text = io.TextIOWrapper(self._stream, encoding="utf-8", newline="")

    def __iter__(self) -> Iterator[str]:
        for line in self._text:
            line = line.rstrip("\n")
            if line:
                yield line


class StreamingDownloader:
    """Range-resume と checkpointing 付きで remote URL を local path に stream する。

    chunk ごとに verified hash と byte count を進める。 and the
    checkpoint is rewritten atomically. The checkpoint records the sha256
    prefix over the verified bytes, so a corrupted partial cannot be silently
    resumed.
    """

    def __init__(
        self,
        cache_dir: Path,
        opener: Callable[[urllib.request.Request], object] | None = None,
        chunk_bytes: int = CHUNK_BYTES,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.chunk_bytes = chunk_bytes
        self._opener = opener or urllib.request.urlopen

    def _paths_for(self, shard_id: str) -> tuple[Path, Path]:
        shard_path = self.cache_dir / f"{shard_id}.zst"
        checkpoint_path = self.cache_dir / f"{shard_id}.partial.json"
        return shard_path, checkpoint_path

    def _read_checkpoint(self, checkpoint_path: Path) -> CheckpointState | None:
        if not checkpoint_path.exists():
            return None
        try:
            return CheckpointState.from_json(checkpoint_path.read_text("utf-8"))
        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    def _write_checkpoint(self, checkpoint_path: Path, state: CheckpointState) -> None:
        tmp = checkpoint_path.with_suffix(".json.tmp")
        tmp.write_text(state.to_json(), encoding="utf-8")
        os.replace(tmp, checkpoint_path)

    def _verify_partial(self, shard_path: Path, state: CheckpointState) -> bool:
        if not shard_path.exists():
            return False
        actual_size = shard_path.stat().st_size
        if actual_size != state.verified_bytes:
            return False
        hasher = hashlib.sha256()
        with shard_path.open("rb") as fh:
            remaining = state.verified_bytes
            while remaining > 0:
                buf = fh.read(min(self.chunk_bytes, remaining))
                if not buf:
                    return False
                hasher.update(buf)
                remaining -= len(buf)
        return hasher.hexdigest() == state.sha256_prefix_hex

    def download(self, plan: ShardPlan) -> ShardResult:
        parsed = urllib.parse.urlparse(plan.url)
        if parsed.scheme not in {"http", "https", "file"}:
            raise ValueError(
                f"未対応の URL scheme {parsed.scheme!r} for shard {plan.shard_id}"
            )
        shard_path, checkpoint_path = self._paths_for(plan.shard_id)
        state = self._read_checkpoint(checkpoint_path)
        resume_from = 0
        rolling = hashlib.sha256()
        if state is not None and state.url == plan.url and self._verify_partial(shard_path, state):
            resume_from = state.verified_bytes
            with shard_path.open("rb") as fh:
                remaining = resume_from
                while remaining > 0:
                    buf = fh.read(min(self.chunk_bytes, remaining))
                    if not buf:
                        break
                    rolling.update(buf)
                    remaining -= len(buf)
        else:
            if shard_path.exists():
                shard_path.unlink()
            if checkpoint_path.exists():
                checkpoint_path.unlink()

        request = urllib.request.Request(plan.url)
        if resume_from > 0:
            request.add_header("Range", f"bytes={resume_from}-")
        response = self._opener(request)
        try:
            if resume_from > 0:
                status = int(getattr(response, "status", 0) or 0)
                headers = getattr(response, "headers", None)
                content_range = ""
                if headers is not None:
                    content_range = str(headers.get("Content-Range", "") or "")
                if status != 206 or not content_range.startswith(f"bytes {resume_from}-"):
                    # Server ignored or misreported the Range header.
                    # Close the partial response and reissue a full GET
                    # before touching the shard or reading the body.
                    try:
                        response.close()
                    except Exception:
                        pass
                    resume_from = 0
                    rolling = hashlib.sha256()
                    if shard_path.exists():
                        shard_path.unlink()
                    if checkpoint_path.exists():
                        checkpoint_path.unlink()
                    response = self._opener(urllib.request.Request(plan.url))
            mode = "ab" if resume_from > 0 else "wb"
            with shard_path.open(mode) as out:
                while True:
                    buf = response.read(self.chunk_bytes)
                    if not buf:
                        break
                    rolling.update(buf)
                    next_verified = resume_from + len(buf)
                    new_state = CheckpointState(
                        url=plan.url,
                        verified_bytes=next_verified,
                        expected_size=plan.expected_size,
                        sha256_prefix_hex=rolling.hexdigest(),
                    )
                    self._write_checkpoint(checkpoint_path, new_state)
                    out.write(buf)
                    out.flush()
                    resume_from = next_verified
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()

        decompressed_bytes = 0
        document_count = 0
        with shard_path.open("rb") as fh:
            dctx = zstd.ZstdDecompressor()
            reader = dctx.stream_reader(fh)
            while True:
                chunk = reader.read(self.chunk_bytes)
                if not chunk:
                    break
                decompressed_bytes += len(chunk)
                document_count += chunk.count(b"\n")

        return ShardResult(
            shard_id=plan.shard_id,
            url=plan.url,
            raw_bytes=resume_from,
            decompressed_bytes=decompressed_bytes,
            document_count=document_count,
            kept_count=0,
            duplicate_count=0,
            sha256=rolling.hexdigest(),
        )


class ShardPlanner:
    """URL list を planned shard list に変換する。"""

    @staticmethod
    def from_urls(urls: Iterable[str]) -> list[ShardPlan]:
        plans: list[ShardPlan] = []
        for index, url in enumerate(urls):
            shard_id = f"shard-{index:04d}"
            plans.append(ShardPlan(shard_id=shard_id, url=url))
        return plans


class ManifestWriter:
    """shard result を集め、自身の content hash を持つ manifest を作る。"""

    def __init__(self) -> None:
        self._rows: list[dict[str, object]] = []
        self._verdicts: list[dict[str, object]] = []

    def add_shard(self, result: ShardResult) -> None:
        self._rows.append(result.to_manifest_row())

    def add_verdict(self, verdict: DocVerdict) -> None:
        self._verdicts.append(asdict(verdict))

    def write(self, manifest_path: Path) -> str:
        body = {
            "version": 1,
            "generated_at": int(time.time()),
            "shards": self._rows,
            "verdicts": self._verdicts,
        }
        text = json.dumps(body, sort_keys=True, indent=2)
        manifest_sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        manifest_path.write_text(text, encoding="utf-8")
        lock_path = manifest_path.with_suffix(manifest_path.suffix + ".lock")
        lock_path.write_text(json.dumps({"manifest_sha256": manifest_sha}), encoding="utf-8")
        return manifest_sha

    @property
    def shards(self) -> list[dict[str, object]]:
        return list(self._rows)

    @property
    def verdicts(self) -> list[dict[str, object]]:
        return list(self._verdicts)


def process_shard(
    plan: ShardPlan,
    downloader: StreamingDownloader,
    dedup: Dedup,
    manifest: ManifestWriter,
) -> ShardResult:
    """1 shard を download、decompress、dedup、accounting する。"""

    result = downloader.download(plan)
    kept = 0
    duplicates = 0
    shard_path = downloader.cache_dir / f"{plan.shard_id}.zst"
    with shard_path.open("rb") as fh:
        for doc_index, line in enumerate(ZstdDocIterator(fh)):
            verdict = dedup.evaluate(plan.shard_id, doc_index, line)
            manifest.add_verdict(verdict)
            if verdict.verdict == "keep":
                kept += 1
            else:
                duplicates += 1
    result = dataclasses.replace(result, kept_count=kept, duplicate_count=duplicates)
    manifest.add_shard(result)
    return result


def build_demo_corpus(directory: Path) -> list[str]:
    """duplicate を含む小さな synthetic corpus を作り、zst shard を書く。

    downloader が取得する file URL list を返す。
    """

    directory.mkdir(parents=True, exist_ok=True)
    base = [
        "alignment problem は reward function と、それを書くときに見落とすものについての話である",
        "alignment problem は reward function と、書き忘れるものについての話である",
        "attention は sequence length に対してよりよく scale するため transformer は recurrent network を置き換えた",
        "attention は sequence length に対してよりよく scale するため transformer は recurrent network を置き換えた",
        "evaluation harness は test corpus を contract として扱い training を正直に保つ",
        "training と evaluation の contract を eval harness が最終的に強制する",
        "deduplication は tokenization の upstream にあり duplicate に tokenization cost を 2 回払わせない",
        "tokenizer は model と corpus の間の vocabulary contract である",
        "buffer を書く前に verified bytes を checkpoint するのが唯一安全な resume order である",
        "the manifest is the deciding edge between data is downloaded and data is verifiable",
    ]
    shards = [base[:5], base[3:9], base[6:]]
    urls: list[str] = []
    for i, group in enumerate(shards):
        payload = ("\n".join(group) + "\n").encode("utf-8")
        compressed = zstd.ZstdCompressor(level=10).compress(payload)
        path = directory / f"corpus-{i:02d}.zst"
        path.write_bytes(compressed)
        urls.append(path.as_uri())
    return urls


def run_demo() -> int:
    with tempfile.TemporaryDirectory() as raw_dir, tempfile.TemporaryDirectory() as cache_dir:
        corpus_dir = Path(raw_dir)
        cache_path = Path(cache_dir)
        urls = build_demo_corpus(corpus_dir)
        plans = ShardPlanner.from_urls(urls)
        downloader = StreamingDownloader(cache_dir=cache_path)
        hasher = MinHasher(num_hashes=128, shingle_width=3)
        index = LSHIndex(num_hashes=128, bands=32)
        dedup = Dedup(hasher=hasher, index=index)
        manifest = ManifestWriter()
        for plan in plans:
            result = process_shard(plan, downloader, dedup, manifest)
            print(
                f"[shard] {result.shard_id} docs={result.document_count} "
                f"kept={result.kept_count} duplicates={result.duplicate_count} "
                f"sha256={result.sha256[:12]}"
            )
        manifest_path = cache_path / "manifest.json"
        manifest_sha = manifest.write(manifest_path)
        kept = sum(int(row["kept_count"]) for row in manifest.shards)
        dup = sum(int(row["duplicate_count"]) for row in manifest.shards)
        print(f"[manifest] sha256={manifest_sha[:12]} kept={kept} duplicates={dup}")
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
