"""gloo backend 上の distributed data parallel from scratch。

CUDA は前提にしない。demo は複数 process を spawn して multi-rank cluster を simulates する。
several worker processes with torch.multiprocessing and connecting them
through the gloo CPU backend. The same collective ops (all_reduce,
broadcast) you would use on a multi-GPU machine show up here; only the
device tag changes.

Three drills:

1. Show that a manual all_reduce of gradients across N ranks matches the
   gradient a single process would compute on the concatenated input.
2. Wrap a model in a from-scratch DDP wrapper that broadcasts parameters
   at construction and averages gradients in a post-backward hook.
3. Sketch FSDP parameter sharding by partitioning the parameter tensors
   across ranks and gathering them for the forward pass.

Run: python3 code/main.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional

import torch
import torch.distributed as dist
import torch.multiprocessing as mp
from torch import nn


HERE = Path(__file__).parent
OUT_DIR = HERE.parent / "outputs"
DEMO_PATH = OUT_DIR / "ddp-demo.json"


@dataclass
class RankResult:
    rank: int
    world_size: int
    backend: str
    final_loss: float
    pre_param_sum: float
    post_param_sum: float
    grad_norm_after_all_reduce: float
    fsdp_round_trip_ok: bool


def init_process_group(rank: int, world_size: int, backend: str, master_port: int) -> None:
    os.environ["MASTER_ADDR"] = "127.0.0.1"
    os.environ["MASTER_PORT"] = str(master_port)
    loopback = "lo0" if sys.platform == "darwin" else "lo"
    os.environ.setdefault("GLOO_SOCKET_IFNAME", loopback)
    os.environ.setdefault("TP_SOCKET_IFNAME", loopback)
    dist.init_process_group(backend=backend, rank=rank, world_size=world_size)


def shutdown_process_group() -> None:
    if dist.is_initialized():
        dist.destroy_process_group()


def make_model(in_dim: int, hidden: int, out_dim: int) -> nn.Module:
    return nn.Sequential(
        nn.Linear(in_dim, hidden),
        nn.GELU(),
        nn.Linear(hidden, out_dim),
    )


def broadcast_module(module: nn.Module, src: int = 0) -> None:
    for tensor in list(module.parameters()) + list(module.buffers()):
        dist.broadcast(tensor.data, src=src)


def all_reduce_grads_(module: nn.Module, world_size: int) -> float:
    """rank 間で gradient を合計し world size で割り、L2 norm を返す。"""
    total_sq = 0.0
    for p in module.parameters():
        if p.grad is None:
            p.grad = torch.zeros_like(p.data)
        dist.all_reduce(p.grad.data, op=dist.ReduceOp.SUM)
        p.grad.data.div_(world_size)
        total_sq += float(p.grad.data.pow(2).sum().item())
    return total_sq ** 0.5


def shard_for_rank(x: torch.Tensor, rank: int, world_size: int) -> torch.Tensor:
    total = x.shape[0]
    per = total // world_size
    remainder = total - per * world_size
    start = rank * per + min(rank, remainder)
    end = start + per + (1 if rank < remainder else 0)
    return x[start:end]


class MinimalDDP(nn.Module):
    """toy DistributedDataParallel。

    construction 時に rank zero から全 parameter を broadcast し、全 rank をそろえる。
    start from the same weights. On forward, run the wrapped module. After
    backward, the trainer calls `sync_grads()` to all-reduce gradients.

    A production DDP uses a post-backward gradient hook to overlap
    communication with the backward pass and buckets parameters into
    fixed-size chunks for efficient collective use. The shape of the
    contract is the same; the bookkeeping above gets fancy.
    """

    def __init__(self, module: nn.Module, world_size: int):
        super().__init__()
        self.module = module
        self.world_size = world_size
        if dist.is_initialized() and world_size > 1:
            broadcast_module(self.module, src=0)

    def forward(self, *args, **kwargs):
        return self.module(*args, **kwargs)

    def sync_grads(self) -> float:
        if not dist.is_initialized() or self.world_size == 1:
            return _grad_norm(self.module)
        return all_reduce_grads_(self.module, self.world_size)


def _grad_norm(module: nn.Module) -> float:
    total_sq = 0.0
    for p in module.parameters():
        if p.grad is None:
            continue
        total_sq += float(p.grad.data.pow(2).sum().item())
    return total_sq ** 0.5


def fsdp_round_trip_sketch(module: nn.Module, world_size: int, rank: int) -> bool:
    """forward pass 用の parameter sharding と gathering の sketch。

    Each rank keeps a 1/world_size slice of every parameter. Before a
    forward pass the full tensor is reconstructed with all_gather. After
    the use, the full copy is dropped and only the slice remains. This
    keeps the per-rank memory at 1/world_size of the model.

    Gloo's all_gather requires equal output sizes per rank, so the flat
    tensor is right-padded to a multiple of world_size before sharding
    and the padding is dropped after the gather.

    Returns True if the gathered tensor matches the original on every
    rank.
    """
    ok = True
    for p in module.parameters():
        full = p.data.detach().clone()
        flat = full.flatten()
        total = flat.numel()
        per = (total + world_size - 1) // world_size
        padded_total = per * world_size
        pad = padded_total - total
        if pad > 0:
            padded = torch.cat([flat, torch.zeros(pad, dtype=flat.dtype)])
        else:
            padded = flat
        my_slice = padded[rank * per:(rank + 1) * per].clone()
        gathered = [torch.empty(per, dtype=flat.dtype) for _ in range(world_size)]
        dist.all_gather(gathered, my_slice)
        rebuilt_padded = torch.cat(gathered)
        rebuilt = rebuilt_padded[:total].view_as(full)
        if not torch.allclose(rebuilt, full):
            ok = False
            break
    return ok


def manual_all_reduce_matches_single_process(
    rank: int,
    world_size: int,
    in_dim: int,
    out_dim: int,
    batch_size: int,
) -> tuple[float, float]:
    """各 rank は自分の slice で gradient を計算し、all-reduce-mean が full-batch gradient を復元する。
    full-batch gradient up to numerical noise."""
    torch.manual_seed(0)
    full_x = torch.randn(batch_size * world_size, in_dim)
    full_y = torch.randint(low=0, high=out_dim, size=(batch_size * world_size,))
    my_x = shard_for_rank(full_x, rank, world_size)
    my_y = shard_for_rank(full_y, rank, world_size)

    torch.manual_seed(7)
    model = make_model(in_dim, hidden=16, out_dim=out_dim)
    broadcast_module(model, src=0)
    loss_fn = nn.CrossEntropyLoss()
    for p in model.parameters():
        p.grad = None
    out = model(my_x)
    loss = loss_fn(out, my_y)
    loss.backward()
    norm_after = all_reduce_grads_(model, world_size)

    if rank == 0:
        torch.manual_seed(7)
        ref_model = make_model(in_dim, hidden=16, out_dim=out_dim)
        for p in ref_model.parameters():
            p.grad = None
        ref_loss = loss_fn(ref_model(full_x), full_y)
        ref_loss.backward()
        ref_norm = _grad_norm(ref_model)
        diffs = []
        for p, q in zip(model.parameters(), ref_model.parameters()):
            diffs.append(float((p.grad.data - q.grad.data).abs().max().item()))
        max_diff = max(diffs)
    else:
        ref_norm = 0.0
        max_diff = 0.0
    return norm_after, max_diff


def rank_main(
    rank: int,
    world_size: int,
    backend: str,
    master_port: int,
    result_queue,
    in_dim: int,
    hidden: int,
    out_dim: int,
    batch_size: int,
    num_steps: int,
    lr: float,
    seed: int,
) -> None:
    try:
        init_process_group(rank, world_size, backend, master_port)
        torch.manual_seed(seed + rank)

        grad_norm, max_diff = manual_all_reduce_matches_single_process(
            rank, world_size, in_dim, out_dim, batch_size
        )

        torch.manual_seed(seed)
        base = make_model(in_dim, hidden, out_dim)
        ddp_model = MinimalDDP(base, world_size)
        optimizer = torch.optim.SGD(ddp_model.parameters(), lr=lr)
        loss_fn = nn.CrossEntropyLoss()
        pre_param_sum = sum(float(p.data.sum().item()) for p in ddp_model.parameters())
        torch.manual_seed(seed * 31 + rank)
        local_loss = 0.0
        for step in range(num_steps):
            x = torch.randn(batch_size, in_dim)
            y = torch.randint(low=0, high=out_dim, size=(batch_size,))
            optimizer.zero_grad()
            out = ddp_model(x)
            loss = loss_fn(out, y)
            loss.backward()
            ddp_model.sync_grads()
            optimizer.step()
            local_loss = float(loss.detach().item())

        fsdp_ok = fsdp_round_trip_sketch(ddp_model.module, world_size, rank)
        post_param_sum = sum(float(p.data.sum().item()) for p in ddp_model.parameters())

        result = RankResult(
            rank=rank,
            world_size=world_size,
            backend=backend,
            final_loss=local_loss,
            pre_param_sum=pre_param_sum,
            post_param_sum=post_param_sum,
            grad_norm_after_all_reduce=grad_norm,
            fsdp_round_trip_ok=fsdp_ok,
        )
        result_queue.put((rank, result.__dict__, max_diff))
    except Exception as exc:
        result_queue.put((rank, {"error": str(exc), "rank": rank}, -1.0))
    finally:
        shutdown_process_group()


def free_port() -> int:
    import socket

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def run_distributed_demo(
    world_size: int = 2,
    *,
    backend: str = "gloo",
    in_dim: int = 32,
    hidden: int = 16,
    out_dim: int = 4,
    batch_size: int = 8,
    num_steps: int = 6,
    lr: float = 0.05,
    seed: int = 0,
    timeout: float = 60.0,
) -> Dict[str, object]:
    ctx = mp.get_context("spawn")
    result_queue = ctx.Queue()
    port = free_port()
    procs = []
    for rank in range(world_size):
        p = ctx.Process(
            target=rank_main,
            args=(
                rank,
                world_size,
                backend,
                port,
                result_queue,
                in_dim,
                hidden,
                out_dim,
                batch_size,
                num_steps,
                lr,
                seed,
            ),
        )
        p.start()
        procs.append(p)
    results: Dict[int, dict] = {}
    max_diff = 0.0
    deadline = time.time() + timeout
    collected = 0
    while collected < world_size and time.time() < deadline:
        try:
            rank, payload, diff = result_queue.get(timeout=1.0)
        except Exception:
            continue
        results[rank] = payload
        if diff > max_diff:
            max_diff = diff
        collected += 1
    for p in procs:
        p.join(timeout=max(1.0, deadline - time.time()))
    if any(p.is_alive() for p in procs):
        for p in procs:
            if p.is_alive():
                p.terminate()
        raise RuntimeError("rank が時間内に完了しませんでした")
    if collected < world_size:
        raise RuntimeError(f"取得できた result 数: {collected}/{world_size} results: {results}")
    for rank, payload in results.items():
        if "error" in payload:
            raise RuntimeError(f"rank {rank} が失敗しました: {payload['error']}")
    param_sums = {r: results[r]["post_param_sum"] for r in results}
    spread = max(param_sums.values()) - min(param_sums.values())
    losses = [results[r]["final_loss"] for r in results]
    grad_norm = results[0]["grad_norm_after_all_reduce"]
    return {
        "world_size": world_size,
        "backend": backend,
        "param_sum_per_rank": param_sums,
        "param_sum_spread": spread,
        "losses": losses,
        "grad_norm_after_all_reduce": grad_norm,
        "manual_all_reduce_max_diff_vs_single_process": max_diff,
        "fsdp_round_trip_all_ranks_ok": all(results[r]["fsdp_round_trip_ok"] for r in results),
    }


def write_demo(payload: Dict[str, object], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"schema": "ddp-demo.v1", **payload}, indent=2) + "\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--world-size", type=int, default=2)
    p.add_argument("--backend", type=str, default="gloo")
    p.add_argument("--num-steps", type=int, default=6)
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--no-write", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if not dist.is_available():
        print("torch.distributed が利用できないため demo を skip します")
        return 0
    if args.backend == "gloo" and not dist.is_gloo_available():
        print("gloo backend が compiled されていないため CPU で実行できません。gloo support 付き build を install してください。")
        return 1
    print(f"distributed demo を実行します: backend={args.backend}, world_size={args.world_size}")
    result = run_distributed_demo(
        world_size=args.world_size,
        backend=args.backend,
        num_steps=args.num_steps,
        batch_size=args.batch_size,
        seed=args.seed,
    )
    print(json.dumps(result, indent=2))
    assert result["param_sum_spread"] < 1e-3, "rank 間で parameter が diverge しました"
    assert result["fsdp_round_trip_all_ranks_ok"], "FSDP sketch の round trip に失敗しました"
    assert result["manual_all_reduce_max_diff_vs_single_process"] < 1e-4, "manual all-reduce が single-process gradient と一致しません"
    if not args.no_write:
        write_demo(result, DEMO_PATH)
        print(f"書き込みました: {DEMO_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
