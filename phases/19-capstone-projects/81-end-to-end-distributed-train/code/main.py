"""End-to-end distributed training: tiny GPT, 4 ranks, DDP + ZeRO-1 + sharded checkpoint.

Composes the pieces built in lessons 76-80:
  * gloo backend with file rendezvous (lesson 76)
  * broadcast at init for DDP-shape parameter sync (lesson 77)
  * reduce_scatter on grad + allgather on params for ZeRO-1 (lesson 78)
  * sharded checkpoint with atomic write at the halfway mark (lesson 80)

20 steps, self-terminating, prints loss curve, per-rank memory profile, and a
RESUME VERIFIED line proving the step-10 checkpoint reloads byte-equal.

Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
import math
import multiprocessing as mp
import os
import shutil
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
import torch.distributed as dist
import torch.nn as nn
import torch.nn.functional as F


SEED = 41
WORLD_SIZE = 4
STEPS = 20
CHECKPOINT_STEP = 10
BATCH = 4
SEQ_LEN = 16
VOCAB = 64
EMBED_DIM = 32
NUM_HEADS = 4
NUM_LAYERS = 2
LR = 5e-3


def _loopback_iface() -> str:
    return "lo0" if sys.platform == "darwin" else "lo"


class CausalSelfAttention(nn.Module):
    def __init__(self, embed_dim: int, num_heads: int):
        super().__init__()
        assert embed_dim % num_heads == 0
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        self.qkv = nn.Linear(embed_dim, 3 * embed_dim, bias=False)
        self.proj = nn.Linear(embed_dim, embed_dim, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, t, e = x.shape
        qkv = self.qkv(x).reshape(b, t, 3, self.num_heads, self.head_dim)
        q, k, v = qkv.unbind(dim=2)
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)
        attn = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        mask = torch.triu(torch.ones(t, t), diagonal=1).bool()
        attn = attn.masked_fill(mask, float("-inf"))
        attn = attn.softmax(dim=-1)
        out = attn @ v
        out = out.transpose(1, 2).reshape(b, t, e)
        return self.proj(out)


class TransformerBlock(nn.Module):
    def __init__(self, embed_dim: int, num_heads: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(embed_dim)
        self.attn = CausalSelfAttention(embed_dim, num_heads)
        self.ln2 = nn.LayerNorm(embed_dim)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, 4 * embed_dim),
            nn.GELU(),
            nn.Linear(4 * embed_dim, embed_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
        x = x + self.mlp(self.ln2(x))
        return x


class MiniGPT(nn.Module):
    def __init__(self, vocab: int = VOCAB, embed_dim: int = EMBED_DIM,
                 num_heads: int = NUM_HEADS, num_layers: int = NUM_LAYERS,
                 seq_len: int = SEQ_LEN):
        super().__init__()
        self.tok_embed = nn.Embedding(vocab, embed_dim)
        self.pos_embed = nn.Embedding(seq_len, embed_dim)
        self.blocks = nn.ModuleList([
            TransformerBlock(embed_dim, num_heads) for _ in range(num_layers)
        ])
        self.ln_f = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, vocab, bias=False)
        self.seq_len = seq_len

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        b, t = ids.shape
        pos = torch.arange(t, device=ids.device)
        x = self.tok_embed(ids) + self.pos_embed(pos)
        for blk in self.blocks:
            x = blk(x)
        x = self.ln_f(x)
        return self.head(x)


def flat_param_numel(module: nn.Module) -> int:
    return sum(p.numel() for p in module.parameters())


def gather_flat_params(module: nn.Module) -> torch.Tensor:
    return torch.cat([p.detach().to(torch.float32).flatten() for p in module.parameters()])


def scatter_flat_to_params(module: nn.Module, flat: torch.Tensor) -> None:
    offset = 0
    for p in module.parameters():
        n = p.numel()
        p.data.copy_(flat[offset:offset + n].reshape(p.shape).to(p.dtype))
        offset += n


def gather_flat_grads(module: nn.Module) -> torch.Tensor:
    parts = []
    for p in module.parameters():
        if p.grad is None:
            parts.append(torch.zeros_like(p.data, dtype=torch.float32).flatten())
        else:
            parts.append(p.grad.detach().to(torch.float32).flatten())
    return torch.cat(parts)


class ZeroOptimizer:
    """Stage-1 sharded Adam, ported from lesson 78."""

    def __init__(self, module: nn.Module, world_size: int, rank: int,
                 lr: float = LR, beta1: float = 0.9, beta2: float = 0.999,
                 eps: float = 1e-8):
        self.module = module
        self.world_size = world_size
        self.rank = rank
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.step_count = 0
        total = flat_param_numel(module)
        self.total = total
        pad = (-total) % world_size
        self.chunk = (total + pad) // world_size
        full = gather_flat_params(module)
        padded = torch.zeros(self.chunk * world_size, dtype=torch.float32)
        padded[:total] = full
        self.master_shard = padded[rank * self.chunk:(rank + 1) * self.chunk].clone()
        self.m_shard = torch.zeros_like(self.master_shard)
        self.v_shard = torch.zeros_like(self.master_shard)

    def shard_bytes(self) -> int:
        return (self.master_shard.numel() + self.m_shard.numel() + self.v_shard.numel()) * 4

    def step(self) -> None:
        flat_grad = gather_flat_grads(self.module)
        pad = (-self.total) % self.world_size
        padded = torch.zeros(self.total + pad, dtype=torch.float32)
        padded[:self.total] = flat_grad
        chunks = [c.contiguous() for c in padded.chunk(self.world_size)]
        local_grad = torch.zeros_like(chunks[0])
        dist.reduce_scatter(local_grad, chunks, op=dist.ReduceOp.SUM)
        local_grad.div_(self.world_size)
        self.step_count += 1
        self.m_shard.mul_(self.beta1).add_(local_grad, alpha=1 - self.beta1)
        self.v_shard.mul_(self.beta2).addcmul_(local_grad, local_grad, value=1 - self.beta2)
        bc1 = 1 - self.beta1 ** self.step_count
        bc2 = 1 - self.beta2 ** self.step_count
        m_hat = self.m_shard / bc1
        v_hat = self.v_shard / bc2
        self.master_shard.addcdiv_(m_hat, v_hat.sqrt().add_(self.eps), value=-self.lr)
        gathered = [torch.zeros_like(self.master_shard) for _ in range(self.world_size)]
        dist.all_gather(gathered, self.master_shard)
        flat_full = torch.cat(gathered)[:self.total]
        scatter_flat_to_params(self.module, flat_full)

    def zero_grad(self) -> None:
        for p in self.module.parameters():
            if p.grad is not None:
                p.grad.detach_()
                p.grad.zero_()

    def state_dict(self) -> dict:
        return {
            "master_shard": self.master_shard.clone(),
            "m_shard": self.m_shard.clone(),
            "v_shard": self.v_shard.clone(),
            "step_count": self.step_count,
        }

    def load_state_dict(self, state: dict) -> None:
        self.master_shard.copy_(state["master_shard"])
        self.m_shard.copy_(state["m_shard"])
        self.v_shard.copy_(state["v_shard"])
        self.step_count = state["step_count"]


@dataclass
class ShardEntry:
    rank: int
    path: str
    sha256: str


def _sha(data: bytes) -> str:
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


def _serialize(state: dict) -> bytes:
    import io
    buf = io.BytesIO()
    torch.save(state, buf, pickle_protocol=4)
    return buf.getvalue()


def _deserialize(data: bytes) -> dict:
    import io
    _assert_safe_torch_for_weights_only()
    return torch.load(io.BytesIO(data), weights_only=True)


def save_sharded(per_rank_state: list, dest_dir: str, step: int) -> dict:
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    shards = []
    tmps = []
    for rank, state in enumerate(per_rank_state):
        payload = _serialize(state)
        sha = _sha(payload)
        tmp_name = f"rank{rank}.bin.tmp"
        final_name = f"rank{rank}.bin"
        with open(dest / tmp_name, "wb") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        tmps.append((dest / tmp_name, dest / final_name))
        shards.append(ShardEntry(rank=rank, path=final_name, sha256=sha))
    manifest = {
        "world_size": len(per_rank_state),
        "step": step,
        "shards": [asdict(s) for s in shards],
    }
    manifest_tmp = dest / "manifest.json.tmp"
    with open(manifest_tmp, "w") as f:
        f.write(json.dumps(manifest, indent=2, sort_keys=True))
        f.flush()
        os.fsync(f.fileno())
    for tmp, final in tmps:
        os.replace(tmp, final)
    os.replace(manifest_tmp, dest / "manifest.json")
    return manifest


def load_sharded(src_dir: str, expected_world_size: int) -> list:
    src = Path(src_dir)
    manifest = json.loads((src / "manifest.json").read_text())
    if manifest["world_size"] != expected_world_size:
        raise RuntimeError(
            f"world_size mismatch: manifest={manifest['world_size']}, "
            f"expected={expected_world_size}"
        )
    per_rank = [None] * manifest["world_size"]
    for entry in manifest["shards"]:
        payload = (src / entry["path"]).read_bytes()
        actual = _sha(payload)
        if actual != entry["sha256"]:
            raise RuntimeError(f"sha256 mismatch on rank {entry['rank']}")
        per_rank[entry["rank"]] = _deserialize(payload)
    return per_rank


def make_corpus(seed: int, total_tokens: int) -> torch.Tensor:
    g = torch.Generator().manual_seed(seed)
    return torch.randint(0, VOCAB, (total_tokens,), generator=g)


def init_distributed(rank: int, world_size: int, init_file: str, iface: str) -> None:
    os.environ["GLOO_SOCKET_IFNAME"] = iface
    dist.init_process_group(
        backend="gloo", init_method=f"file://{init_file}",
        rank=rank, world_size=world_size,
    )


def _gather_payloads_to_rank0(local_payload: bytes, world_size: int) -> list:
    """Allgather variable-length byte buffers across ranks via padding."""
    tensor = torch.frombuffer(bytearray(local_payload), dtype=torch.uint8).clone()
    sizes = [torch.zeros(1, dtype=torch.long) for _ in range(world_size)]
    dist.all_gather(sizes, torch.tensor([tensor.numel()], dtype=torch.long))
    max_size = max(int(s.item()) for s in sizes)
    padded = torch.zeros(max_size, dtype=torch.uint8)
    padded[:tensor.numel()] = tensor
    gathered = [torch.zeros(max_size, dtype=torch.uint8) for _ in range(world_size)]
    dist.all_gather(gathered, padded)
    return [bytes(gathered[r][:int(sizes[r].item())].tolist()) for r in range(world_size)]


def _train_worker(rank: int, world_size: int, init_file: str, iface: str,
                  ckpt_dir: str, steps: int, out_queue) -> None:
    init_distributed(rank, world_size, init_file, iface)
    torch.manual_seed(SEED)
    model = MiniGPT()
    for p in model.parameters():
        dist.broadcast(p.data, src=0)
    optim = ZeroOptimizer(model, world_size=world_size, rank=rank, lr=LR)
    corpus_total = world_size * BATCH * (SEQ_LEN + 1) * steps
    corpus = make_corpus(SEED + 7, corpus_total)
    rank0_losses = []
    master_at_ckpt = None
    for step in range(steps):
        offset = step * world_size * BATCH * (SEQ_LEN + 1) + rank * BATCH * (SEQ_LEN + 1)
        block = corpus[offset:offset + BATCH * (SEQ_LEN + 1)].reshape(BATCH, SEQ_LEN + 1)
        x = block[:, :-1]
        y = block[:, 1:]
        optim.zero_grad()
        logits = model(x)
        loss = F.cross_entropy(logits.reshape(-1, VOCAB), y.reshape(-1))
        loss.backward()
        optim.step()
        if rank == 0:
            rank0_losses.append(loss.item())
        if step + 1 == CHECKPOINT_STEP:
            state = {
                "model_state": {k: v.clone() for k, v in model.state_dict().items()},
                "optim_state": optim.state_dict(),
                "rank": rank,
            }
            master_at_ckpt = optim.master_shard.clone()
            dist.barrier()
            payloads = _gather_payloads_to_rank0(_serialize(state), world_size)
            if rank == 0:
                all_states = [_deserialize(p) for p in payloads]
                save_sharded(all_states, ckpt_dir, step=CHECKPOINT_STEP)
            dist.barrier()
    param_norm = sum(p.detach().pow(2).sum().item() for p in model.parameters()) ** 0.5
    out_queue.put((rank, rank0_losses if rank == 0 else [], param_norm, optim.shard_bytes(),
                   master_at_ckpt))
    out_queue.close()
    out_queue.join_thread()
    os._exit(0)


def run_e2e(world_size: int = WORLD_SIZE, steps: int = STEPS) -> dict:
    ctx = mp.get_context("spawn")
    out_queue = ctx.Queue()
    workdir = tempfile.mkdtemp(prefix="aie_e2e_")
    init_file = os.path.join(workdir, "rendezvous")
    ckpt_dir = os.path.join(workdir, f"step_{CHECKPOINT_STEP:04d}")
    iface = _loopback_iface()
    procs = []
    cleanup_workdir = False
    try:
        try:
            for r in range(world_size):
                p = ctx.Process(
                    target=_train_worker,
                    args=(r, world_size, init_file, iface, ckpt_dir, steps, out_queue),
                )
                p.start()
                procs.append(p)
            results = {}
            for _ in range(world_size):
                rank, losses, norm, shard_bytes, master_at_ckpt = out_queue.get(timeout=180)
                results[rank] = {
                    "losses": losses,
                    "norm": norm,
                    "shard_bytes": shard_bytes,
                    "master_at_ckpt": master_at_ckpt,
                }
        except Exception:
            cleanup_workdir = True
            raise
    finally:
        for p in procs:
            p.join(timeout=5)
            if p.is_alive():
                p.terminate()
                p.join(timeout=2)
        if cleanup_workdir:
            shutil.rmtree(workdir, ignore_errors=True)
    return {"workdir": workdir, "ckpt_dir": ckpt_dir, "results": results}


def verify_resume(ckpt_dir: str, expected_world_size: int,
                  expected_master_shards: list) -> bool:
    """Reload the checkpoint and compare master shards byte-equal to the snapshot.

    Each rank captured its master shard at the moment of the checkpoint write;
    reloading the saved manifest must return the same tensor byte-for-byte.
    """
    loaded = load_sharded(ckpt_dir, expected_world_size=expected_world_size)
    for r in range(expected_world_size):
        saved = loaded[r]["optim_state"]["master_shard"]
        snapshot = expected_master_shards[r]
        if not torch.equal(saved, snapshot):
            return False
    return True


def main() -> int:
    print(f"world_size={WORLD_SIZE}, steps={STEPS}, model=MiniGPT")
    total_params = flat_param_numel(MiniGPT())
    print(f"model params: {total_params}")
    print("starting distributed train...")
    out = run_e2e()
    results = out["results"]
    ckpt_dir = out["ckpt_dir"]
    print(f"\n{'step':<6}{'rank0_loss':<14}")
    rank0_losses = results[0]["losses"]
    for s, loss in enumerate(rank0_losses):
        print(f"{s:<6}{loss:<14.6f}")
    norms = [results[r]["norm"] for r in range(WORLD_SIZE)]
    print("\nfinal param norm (must agree across ranks):")
    for r in range(WORLD_SIZE):
        print(f"  rank {r}: {norms[r]:.6f}")
    norm_drift = max(norms) - min(norms)
    print(f"  drift across ranks: {norm_drift:.2e}")
    print("\nper-rank optimiser memory (ZeRO-1 shard, bytes):")
    for r in range(WORLD_SIZE):
        print(f"  rank {r}: {results[r]['shard_bytes']}")
    expected_zero = (total_params + (-total_params) % WORLD_SIZE) // WORLD_SIZE * 4 * 3
    print(f"  expected per-rank (fp32 master + m + v): {expected_zero}")
    print(f"\ncheckpoint at step {CHECKPOINT_STEP}: {ckpt_dir}")
    master_shards = [results[r]["master_at_ckpt"] for r in range(WORLD_SIZE)]
    if verify_resume(ckpt_dir, WORLD_SIZE, master_shards):
        print("RESUME VERIFIED: saved shard at step 10 matches in-memory snapshot byte-for-byte")
    else:
        print("RESUME FAILED")
        return 1
    shutil.rmtree(out["workdir"], ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
