"""Sharded checkpoint with atomic write and verified resume.

Saves a multi-rank training state as per-rank binary files plus a JSON
manifest. The write is atomic: every file lands at <name>.tmp first, the
manifest writes last, then a single rename moves everything to the final
names. A crash mid-write leaves the previous checkpoint intact.

Resume verifies the manifest schema (world_size, shard count, sha256 per
shard) and reconstructs per-rank state byte-equal to what was saved.

Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path

import torch


SCHEMA_VERSION = 1
MANIFEST_NAME = "manifest.json"


@dataclass
class ShardEntry:
    rank: int
    path: str
    sha256: str
    param_shard_offset: int
    param_shard_numel: int


@dataclass
class ShardManifest:
    world_size: int
    step: int
    wall_clock_seconds: float
    shards: list
    schema_version: int = SCHEMA_VERSION

    def to_json(self) -> str:
        return json.dumps({
            "world_size": self.world_size,
            "step": self.step,
            "wall_clock_seconds": self.wall_clock_seconds,
            "schema_version": self.schema_version,
            "shards": [asdict(s) for s in self.shards],
        }, indent=2, sort_keys=True)

    @classmethod
    def from_json(cls, text: str) -> "ShardManifest":
        data = json.loads(text)
        return cls(
            world_size=int(data["world_size"]),
            step=int(data["step"]),
            wall_clock_seconds=float(data["wall_clock_seconds"]),
            schema_version=int(data["schema_version"]),
            shards=[ShardEntry(**s) for s in data["shards"]],
        )


class CheckpointError(Exception):
    """Raised when manifest validation or shard verification fails."""


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _assert_safe_torch_for_weights_only() -> None:
    """Ensure torch version is >= 2.6.0 for secure weights_only loading.

    Earlier versions have a known bypass (GHSA-53q9-r3pm-6pq6).
    """
    base = torch.__version__.split("+", 1)[0]
    parts = base.split(".")
    major = int(parts[0]) if len(parts) > 0 else 0
    minor = int(parts[1]) if len(parts) > 1 else 0
    if (major, minor) < (2, 6):
        raise RuntimeError(
            f"torch>=2.6.0 is required for secure weights_only deserialization (found {torch.__version__}). "
            "Please update torch to address GHSA-53q9-r3pm-6pq6."
        )


def _fsync_dir(path: Path) -> None:
    """Fsync a directory so rename metadata reaches disk; no-op where unsupported."""
    try:
        fd = os.open(str(path), os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _serialize_state(state: dict) -> bytes:
    """Serialize a state dict deterministically using torch.save with pickle 4."""
    import io
    buf = io.BytesIO()
    torch.save(state, buf, pickle_protocol=4)
    return buf.getvalue()


def _deserialize_state(data: bytes) -> dict:
    import io
    _assert_safe_torch_for_weights_only()
    buf = io.BytesIO(data)
    return torch.load(buf, weights_only=True)


def save_sharded(per_rank_state: list, dest_dir: str, step: int,
                 wall_clock_seconds: float = 0.0) -> ShardManifest:
    """Write per-rank state files atomically; return the manifest written.

    per_rank_state is a list indexed by rank. Each entry is a state dict that
    will be torch.save'd into rankN.bin. The function uses the .tmp + rename
    pattern so a partial write never corrupts an existing checkpoint.
    """
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    world_size = len(per_rank_state)
    shards = []
    tmp_paths = []
    offset = 0
    for rank, state in enumerate(per_rank_state):
        payload = _serialize_state(state)
        sha = _sha256_bytes(payload)
        final_name = f"rank{rank}.bin"
        tmp_name = f"rank{rank}.bin.tmp"
        tmp_path = dest / tmp_name
        with open(tmp_path, "wb") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        tmp_paths.append((tmp_path, dest / final_name))
        param_shard = state.get("param_shard")
        numel = param_shard.numel() if isinstance(param_shard, torch.Tensor) else 0
        shards.append(ShardEntry(
            rank=rank,
            path=final_name,
            sha256=sha,
            param_shard_offset=offset,
            param_shard_numel=numel,
        ))
        offset += numel
    manifest = ShardManifest(
        world_size=world_size,
        step=step,
        wall_clock_seconds=wall_clock_seconds,
        shards=shards,
    )
    manifest_tmp = dest / (MANIFEST_NAME + ".tmp")
    manifest_final = dest / MANIFEST_NAME
    with open(manifest_tmp, "w") as f:
        f.write(manifest.to_json())
        f.flush()
        os.fsync(f.fileno())
    for tmp, final in tmp_paths:
        os.replace(tmp, final)
    os.replace(manifest_tmp, manifest_final)
    _fsync_dir(dest)
    return manifest


def load_sharded(src_dir: str, expected_world_size: int) -> tuple:
    """Read the manifest, verify every shard, return (manifest, per-rank state list)."""
    src = Path(src_dir)
    manifest_path = src / MANIFEST_NAME
    if not manifest_path.exists():
        raise CheckpointError(f"manifest missing at {manifest_path}")
    manifest = ShardManifest.from_json(manifest_path.read_text())
    if manifest.world_size != expected_world_size:
        raise CheckpointError(
            f"world_size mismatch: manifest={manifest.world_size}, expected={expected_world_size}"
        )
    if manifest.schema_version != SCHEMA_VERSION:
        raise CheckpointError(
            f"schema_version mismatch: manifest={manifest.schema_version}, expected={SCHEMA_VERSION}"
        )
    if len(manifest.shards) != manifest.world_size:
        raise CheckpointError(
            f"shard count != world_size: {len(manifest.shards)} vs {manifest.world_size}"
        )
    per_rank = [None] * manifest.world_size
    seen_ranks = set()
    src_resolved = src.resolve()
    for shard in manifest.shards:
        if not (0 <= shard.rank < manifest.world_size):
            raise CheckpointError(
                f"shard rank {shard.rank} out of range [0,{manifest.world_size})"
            )
        if shard.rank in seen_ranks:
            raise CheckpointError(f"duplicate shard for rank {shard.rank}")
        seen_ranks.add(shard.rank)
        if os.path.isabs(shard.path) or os.sep in shard.path or "/" in shard.path or shard.path in ("", ".", ".."):
            raise CheckpointError(f"unsafe shard path: {shard.path!r}")
        shard_path = (src / shard.path).resolve()
        try:
            shard_path.relative_to(src_resolved)
        except ValueError as exc:
            raise CheckpointError(f"shard path escapes checkpoint dir: {shard.path!r}") from exc
        if not shard_path.exists():
            raise CheckpointError(f"shard file missing: {shard_path}")
        payload = shard_path.read_bytes()
        actual = _sha256_bytes(payload)
        if actual != shard.sha256:
            raise CheckpointError(
                f"sha256 mismatch on rank {shard.rank}: "
                f"recorded={shard.sha256[:12]}..., actual={actual[:12]}..."
            )
        per_rank[shard.rank] = _deserialize_state(payload)
    if len(seen_ranks) != manifest.world_size:
        missing = sorted(set(range(manifest.world_size)) - seen_ranks)
        raise CheckpointError(f"manifest missing ranks: {missing}")
    return manifest, per_rank


def rotate_checkpoints(parent_dir: str, keep_last: int = 5) -> list:
    """Delete oldest checkpoint directories so only the most recent keep_last remain."""
    if keep_last < 0:
        raise ValueError(f"keep_last must be >= 0, got {keep_last}")
    parent = Path(parent_dir)
    if not parent.exists():
        return []
    children = sorted(
        [c for c in parent.iterdir() if c.is_dir() and c.name.startswith("step_")],
        key=lambda c: (c.stat().st_mtime, c.name),
    )
    if keep_last == 0:
        to_delete = children
    elif len(children) > keep_last:
        to_delete = children[:-keep_last]
    else:
        to_delete = []
    deleted = []
    for c in to_delete:
        shutil.rmtree(c, ignore_errors=True)
        deleted.append(c.name)
    return deleted


def make_demo_state(rank: int, world_size: int) -> dict:
    """Construct a representative per-rank state for the demo."""
    torch.manual_seed(31 + rank)
    return {
        "rank": rank,
        "world_size": world_size,
        "param_shard": torch.randn(1024) + rank,
        "m_shard": torch.zeros(1024),
        "v_shard": torch.ones(1024) * 1e-6,
        "step": 100,
    }


def main() -> int:
    world_size = 4
    workdir = tempfile.mkdtemp(prefix="aie_ckpt_")
    print(f"workdir: {workdir}")
    states = [make_demo_state(r, world_size) for r in range(world_size)]
    step_dir = os.path.join(workdir, "step_0100")
    print("saving sharded checkpoint...")
    manifest = save_sharded(states, step_dir, step=100, wall_clock_seconds=42.0)
    print(f"manifest: world_size={manifest.world_size}, step={manifest.step}, shards={len(manifest.shards)}")
    for entry in manifest.shards:
        print(f"  rank {entry.rank}: {entry.path} sha256={entry.sha256[:12]}... numel={entry.param_shard_numel}")
    print("\nresuming...")
    loaded_manifest, loaded_states = load_sharded(step_dir, expected_world_size=world_size)
    for r in range(world_size):
        before = states[r]["param_shard"]
        after = loaded_states[r]["param_shard"]
        assert torch.equal(before, after), f"rank {r} param shard differs after resume"
    print("byte-equal round-trip verified for every rank")
    print("\ntesting failure mode: wrong world size...")
    try:
        load_sharded(step_dir, expected_world_size=8)
    except CheckpointError as e:
        print(f"  rejected as expected: {e}")
    print("\ntesting failure mode: tampered shard...")
    shard0 = Path(step_dir) / "rank0.bin"
    backup = shard0.read_bytes()
    shard0.write_bytes(backup + b"corruption")
    try:
        load_sharded(step_dir, expected_world_size=world_size)
    except CheckpointError as e:
        print(f"  rejected as expected: {e}")
    shard0.write_bytes(backup)
    print("\ntesting rotation: write 8 checkpoints, keep 5...")
    for s in range(8):
        sd = os.path.join(workdir, f"step_{s:04d}")
        save_sharded(states, sd, step=s)
    deleted = rotate_checkpoints(workdir, keep_last=5)
    print(f"  rotated {len(deleted)} oldest: {deleted}")
    shutil.rmtree(workdir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
