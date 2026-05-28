"""checkpoint save and resume を from scratch で実装する。

完全 checkpoint dict: model state、optimizer state、scheduler state、
loss history、current step、RNG state (python random、numpy、torch CPU、
torch CUDA があればそれも含む)。temp file に書いてから rename する atomic save。
renaming. Sharded save splits the model state by parameter group so a
single shard is small enough to load on demand. Resume continues mid
epoch with deterministic loss within tolerance.

Run: python3 code/main.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch
from torch import nn


HERE = Path(__file__).parent
OUT_DIR = HERE.parent / "outputs"

CHECKPOINT_SCHEMA = "ckpt.v1"
SHARD_SCHEMA = "ckpt-shard.v1"


@dataclass
class TrainState:
    step: int
    epoch: int
    batch_in_epoch: int
    losses: List[float] = field(default_factory=list)


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def make_model(in_dim: int, hidden: int, out_dim: int) -> nn.Module:
    return nn.Sequential(
        nn.Linear(in_dim, hidden),
        nn.GELU(),
        nn.Linear(hidden, hidden),
        nn.GELU(),
        nn.Linear(hidden, out_dim),
    )


def make_optimizer_and_scheduler(model: nn.Module, lr: float, total_steps: int):
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_steps)
    return opt, sched


def synthetic_loader(batch_size: int, num_batches: int, in_dim: int, out_dim: int, gen: torch.Generator):
    for _ in range(num_batches):
        x = torch.randn(batch_size, in_dim, generator=gen)
        y = torch.randint(low=0, high=out_dim, size=(batch_size,), generator=gen)
        yield x, y


def capture_rng_state() -> Dict[str, Any]:
    state: Dict[str, Any] = {
        "python": random.getstate(),
        "numpy": np.random.get_state(),
        "torch_cpu": torch.get_rng_state().tolist(),
    }
    if torch.cuda.is_available():
        state["torch_cuda"] = [s.tolist() for s in torch.cuda.get_rng_state_all()]
    return state


def restore_rng_state(state: Dict[str, Any]) -> None:
    py = state.get("python")
    if py is not None:
        random.setstate(tuple_from_nested(py))
    np_state = state.get("numpy")
    if np_state is not None:
        np.random.set_state(tuple_from_nested(np_state))
    cpu = state.get("torch_cpu")
    if cpu is not None:
        torch.set_rng_state(torch.tensor(cpu, dtype=torch.uint8))
    cuda = state.get("torch_cuda")
    if cuda is not None and torch.cuda.is_available():
        torch.cuda.set_rng_state_all([torch.tensor(s, dtype=torch.uint8) for s in cuda])


def tuple_from_nested(obj):
    if isinstance(obj, list):
        return tuple(tuple_from_nested(x) for x in obj)
    return obj


def atomic_save(payload: Dict[str, Any], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = tempfile.NamedTemporaryFile(
        delete=False,
        dir=str(path.parent),
        prefix=path.name + ".",
        suffix=".tmp",
    )
    tmp_path = Path(tmp.name)
    tmp.close()
    try:
        torch.save(payload, tmp_path)
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass
    return path


def atomic_write_json(payload: Dict[str, Any], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = tempfile.NamedTemporaryFile(
        mode="w",
        delete=False,
        dir=str(path.parent),
        prefix=path.name + ".",
        suffix=".tmp",
        encoding="utf-8",
    )
    tmp_path = Path(tmp.name)
    try:
        json.dump(payload, tmp, indent=2)
        tmp.write("\n")
        tmp.close()
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass
    return path


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def save_checkpoint(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    state: TrainState,
    out_path: Path,
    *,
    schema: str = CHECKPOINT_SCHEMA,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "schema": schema,
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "scheduler": scheduler.state_dict(),
        "state": {
            "step": state.step,
            "epoch": state.epoch,
            "batch_in_epoch": state.batch_in_epoch,
            "losses": list(state.losses),
        },
        "rng": capture_rng_state(),
        "wall_saved_at": time.time(),
    }
    if extras:
        payload["extras"] = extras
    atomic_save(payload, out_path)
    return payload


def load_checkpoint(
    path: Path,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
) -> TrainState:
    payload = torch.load(path, map_location="cpu", weights_only=False)
    assert payload["schema"].startswith("ckpt"), f"unknown schema {payload['schema']}"
    model.load_state_dict(payload["model"])
    optimizer.load_state_dict(payload["optimizer"])
    scheduler.load_state_dict(payload["scheduler"])
    restore_rng_state(payload["rng"])
    s = payload["state"]
    return TrainState(
        step=int(s["step"]),
        epoch=int(s["epoch"]),
        batch_in_epoch=int(s["batch_in_epoch"]),
        losses=list(s["losses"]),
    )


def shard_keys_by_prefix(state_dict: Dict[str, torch.Tensor], num_shards: int) -> Dict[int, List[str]]:
    """parameter key を shard に round-robin で割り当てる。

    Production sharding usually goes by parameter group or by layer. The
    round robin keeps the shards roughly the same size for the demo and
    keeps the index easy to read.
    """
    if num_shards < 1:
        raise ValueError("num_shards must be >= 1")
    keys = sorted(state_dict.keys())
    shards: Dict[int, List[str]] = {i: [] for i in range(num_shards)}
    for i, k in enumerate(keys):
        shards[i % num_shards].append(k)
    return shards


def save_sharded_checkpoint(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    state: TrainState,
    out_dir: Path,
    *,
    num_shards: int,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    model_sd = model.state_dict()
    layout = shard_keys_by_prefix(model_sd, num_shards)
    shard_files: List[Dict[str, Any]] = []
    for shard_idx in range(num_shards):
        keys = layout[shard_idx]
        tensors = {k: model_sd[k] for k in keys}
        shard_path = out_dir / f"model.shard-{shard_idx:03d}.pt"
        atomic_save({"schema": SHARD_SCHEMA, "tensors": tensors, "keys": keys}, shard_path)
        shard_files.append({
            "shard": shard_idx,
            "path": shard_path.name,
            "num_params": len(keys),
            "sha256": file_sha256(shard_path),
        })
    meta_path = out_dir / "meta.pt"
    meta_payload = {
        "schema": CHECKPOINT_SCHEMA + "-sharded",
        "optimizer": optimizer.state_dict(),
        "scheduler": scheduler.state_dict(),
        "state": {
            "step": state.step,
            "epoch": state.epoch,
            "batch_in_epoch": state.batch_in_epoch,
            "losses": list(state.losses),
        },
        "rng": capture_rng_state(),
        "wall_saved_at": time.time(),
        "shards": shard_files,
        "extras": extras or {},
    }
    atomic_save(meta_payload, meta_path)
    index_payload = {
        "schema": CHECKPOINT_SCHEMA + "-index",
        "num_shards": num_shards,
        "shards": shard_files,
        "meta_sha256": file_sha256(meta_path),
        "saved_at": meta_payload["wall_saved_at"],
        "step": state.step,
    }
    atomic_write_json(index_payload, out_dir / "index.json")
    return meta_payload


def load_sharded_checkpoint(
    ckpt_dir: Path,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
) -> TrainState:
    index = json.loads((ckpt_dir / "index.json").read_text())
    expected_sha = index["meta_sha256"]
    meta_path = ckpt_dir / "meta.pt"
    actual_sha = file_sha256(meta_path)
    assert actual_sha == expected_sha, f"meta sha mismatch: {actual_sha} != {expected_sha}"
    meta = torch.load(meta_path, map_location="cpu", weights_only=False)
    merged: Dict[str, torch.Tensor] = {}
    for shard in meta["shards"]:
        shard_path = ckpt_dir / shard["path"]
        actual = file_sha256(shard_path)
        assert actual == shard["sha256"], f"shard sha mismatch: {shard['path']}"
        body = torch.load(shard_path, map_location="cpu", weights_only=False)
        assert body["schema"] == SHARD_SCHEMA
        merged.update(body["tensors"])
    model.load_state_dict(merged)
    optimizer.load_state_dict(meta["optimizer"])
    scheduler.load_state_dict(meta["scheduler"])
    restore_rng_state(meta["rng"])
    s = meta["state"]
    return TrainState(
        step=int(s["step"]),
        epoch=int(s["epoch"]),
        batch_in_epoch=int(s["batch_in_epoch"]),
        losses=list(s["losses"]),
    )


def step_one(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    x: torch.Tensor,
    y: torch.Tensor,
    loss_fn,
) -> float:
    optimizer.zero_grad()
    loss = loss_fn(model(x), y)
    loss.backward()
    optimizer.step()
    scheduler.step()
    return float(loss.detach().item())


def train_until(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    loss_fn,
    state: TrainState,
    *,
    stop_step: int,
    batches_per_epoch: int,
    batch_size: int,
    in_dim: int,
    out_dim: int,
) -> TrainState:
    while state.step < stop_step:
        gen = torch.Generator()
        gen.manual_seed(12345 + state.epoch)
        for _ in range(state.batch_in_epoch):
            torch.randn(batch_size, in_dim, generator=gen)
            torch.randint(low=0, high=out_dim, size=(batch_size,), generator=gen)
        while state.batch_in_epoch < batches_per_epoch and state.step < stop_step:
            x = torch.randn(batch_size, in_dim, generator=gen)
            y = torch.randint(low=0, high=out_dim, size=(batch_size,), generator=gen)
            loss = step_one(model, optimizer, scheduler, x, y, loss_fn)
            state.losses.append(loss)
            state.step += 1
            state.batch_in_epoch += 1
        if state.batch_in_epoch >= batches_per_epoch:
            state.epoch += 1
            state.batch_in_epoch = 0
    return state


def run_resume_demo(
    *,
    total_steps: int = 30,
    interrupt_at: int = 12,
    in_dim: int = 16,
    hidden: int = 24,
    out_dim: int = 4,
    batch_size: int = 4,
    batches_per_epoch: int = 5,
    seed: int = 11,
    ckpt_dir: Path,
    sharded: bool = False,
    num_shards: int = 3,
) -> Dict[str, Any]:
    loss_fn = nn.CrossEntropyLoss()

    seed_everything(seed)
    m1 = make_model(in_dim, hidden, out_dim)
    o1, s1 = make_optimizer_and_scheduler(m1, lr=0.01, total_steps=total_steps)
    state_1 = TrainState(step=0, epoch=0, batch_in_epoch=0)
    train_until(
        m1, o1, s1, loss_fn, state_1,
        stop_step=interrupt_at,
        batches_per_epoch=batches_per_epoch,
        batch_size=batch_size,
        in_dim=in_dim,
        out_dim=out_dim,
    )
    if sharded:
        save_sharded_checkpoint(m1, o1, s1, state_1, ckpt_dir, num_shards=num_shards)
    else:
        save_checkpoint(m1, o1, s1, state_1, ckpt_dir / "ckpt.pt")
    train_until(
        m1, o1, s1, loss_fn, state_1,
        stop_step=total_steps,
        batches_per_epoch=batches_per_epoch,
        batch_size=batch_size,
        in_dim=in_dim,
        out_dim=out_dim,
    )
    full_losses = list(state_1.losses)

    seed_everything(seed)
    m2 = make_model(in_dim, hidden, out_dim)
    o2, s2 = make_optimizer_and_scheduler(m2, lr=0.01, total_steps=total_steps)
    if sharded:
        loaded = load_sharded_checkpoint(ckpt_dir, m2, o2, s2)
    else:
        loaded = load_checkpoint(ckpt_dir / "ckpt.pt", m2, o2, s2)
    train_until(
        m2, o2, s2, loss_fn, loaded,
        stop_step=total_steps,
        batches_per_epoch=batches_per_epoch,
        batch_size=batch_size,
        in_dim=in_dim,
        out_dim=out_dim,
    )
    resumed_losses = list(loaded.losses)

    suffix_full = full_losses[interrupt_at:]
    suffix_resumed = resumed_losses[interrupt_at:]
    if not suffix_full:
        max_diff = 0.0
    else:
        max_diff = max(abs(a - b) for a, b in zip(suffix_full, suffix_resumed, strict=True))
    return {
        "interrupt_at": interrupt_at,
        "total_steps": total_steps,
        "max_loss_diff_after_resume": max_diff,
        "full_losses": full_losses,
        "resumed_losses": resumed_losses,
        "sharded": sharded,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--total-steps", type=int, default=24)
    p.add_argument("--interrupt-at", type=int, default=10)
    p.add_argument("--sharded", action="store_true")
    p.add_argument("--num-shards", type=int, default=3)
    p.add_argument("--seed", type=int, default=11)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    with tempfile.TemporaryDirectory(prefix="ckpt-demo-") as scratch:
        scratch_dir = Path(scratch)
        print("resume demo を実行します (single file checkpoint)")
        single = run_resume_demo(
            total_steps=args.total_steps,
            interrupt_at=args.interrupt_at,
            ckpt_dir=scratch_dir / "single",
            sharded=False,
            seed=args.seed,
        )
        print(json.dumps({k: v for k, v in single.items() if k not in ("full_losses", "resumed_losses")}, indent=2))
        assert single["max_loss_diff_after_resume"] < 1e-4, "single-file resume 後に loss が drift しました"

        print("resume demo を実行します (sharded checkpoint)")
        sharded = run_resume_demo(
            total_steps=args.total_steps,
            interrupt_at=args.interrupt_at,
            ckpt_dir=scratch_dir / "sharded",
            sharded=True,
            num_shards=args.num_shards,
            seed=args.seed,
        )
        print(json.dumps({k: v for k, v in sharded.items() if k not in ("full_losses", "resumed_losses")}, indent=2))
        assert sharded["max_loss_diff_after_resume"] < 1e-4, "sharded resume 後に loss が drift しました"

    summary = {
        "schema": "resume-demo.v1",
        "single": {
            "max_loss_diff_after_resume": single["max_loss_diff_after_resume"],
            "interrupt_at": single["interrupt_at"],
            "total_steps": single["total_steps"],
        },
        "sharded": {
            "max_loss_diff_after_resume": sharded["max_loss_diff_after_resume"],
            "interrupt_at": sharded["interrupt_at"],
            "total_steps": sharded["total_steps"],
            "num_shards": args.num_shards,
        },
    }
    atomic_write_json(summary, OUT_DIR / "resume-demo.json")
    print(f"書き込みました: {OUT_DIR / 'resume-demo.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
