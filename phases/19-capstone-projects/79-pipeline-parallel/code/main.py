"""Pipeline parallel with GPipe schedule and bubble analysis.

Splits a sequential MLP into N stages. The schedule simulates wall-clock for
each stage's forward and backward, then prints a Gantt chart and computes the
bubble fraction against the closed-form (N-1)/(M+N-1) prediction.

A second demo wires a 2-stage real pipeline over torch.distributed gloo:
rank 0 owns stage 0, rank 1 owns stage 1, activations flow over send/recv,
and the schedule trains a small MLP for a few steps to prove the wire works.

Run: python3 code/main.py
"""

from __future__ import annotations

import multiprocessing as mp
import os
import sys
import tempfile

import torch
import torch.distributed as dist
import torch.nn as nn


SEED = 23
NUM_STAGES = 4
NUM_MICROBATCHES = 8
FORWARD_UNITS = 1
BACKWARD_UNITS = 2


def _loopback_iface() -> str:
    return "lo0" if sys.platform == "darwin" else "lo"


def bubble_fraction(num_stages: int, num_microbatches: int) -> float:
    """Closed-form bubble fraction per stage for GPipe.

    Forward takes M + N - 1 cycles per stage (M useful + N - 1 idle warmup).
    Backward takes M + N - 1 cycles per stage (M useful + N - 1 idle drain).
    Total cycles = 2(M + N - 1); useful per stage = 2M.
    Bubble fraction = 2(N - 1) / 2(M + N - 1) = (N - 1) / (M + N - 1).
    """
    n = num_stages
    m = num_microbatches
    return (n - 1) / (m + n - 1)


def gpipe_schedule(num_stages: int, num_microbatches: int) -> list:
    """Return the GPipe schedule as a list of (cycle, stage, microbatch, phase).

    Phase is 'F' for forward, 'B' for backward, '.' for idle. Cycle is the
    integer time slot. Microbatch is the microbatch index.
    """
    n = num_stages
    m = num_microbatches
    schedule = []
    # forward pass: microbatch i enters stage 0 at cycle i, stage k at cycle i+k
    for mb in range(m):
        for stage in range(n):
            cycle = mb + stage
            schedule.append((cycle, stage, mb, "F"))
    # backward pass: microbatch i finishes forward at stage n-1 cycle i+n-1
    # then backward starts at stage n-1 at cycle m+n-1+i and rolls to stage 0
    forward_end = m + n - 1
    for mb in range(m):
        for stage in reversed(range(n)):
            cycle = forward_end + (m - 1 - mb) + (n - 1 - stage)
            schedule.append((cycle, stage, mb, "B"))
    return schedule


def render_gantt(schedule: list, num_stages: int, num_microbatches: int) -> str:
    """Render the schedule as a stage-by-cycle text Gantt chart."""
    n = num_stages
    m = num_microbatches
    max_cycle = max(c for c, _, _, _ in schedule)
    grid = [["." for _ in range(max_cycle + 1)] for _ in range(n)]
    for cycle, stage, mb, phase in schedule:
        grid[stage][cycle] = f"{phase}{mb}" if phase != "." else "."
    lines = []
    header = "stage \\ cycle  " + " ".join(f"{c:>2}" for c in range(max_cycle + 1))
    lines.append(header)
    for s, row in enumerate(grid):
        lines.append(f"stage {s}         " + " ".join(f"{cell:>2}" for cell in row))
    return "\n".join(lines)


def measure_bubble(num_stages: int, num_microbatches: int) -> float:
    """Empirical bubble: count idle slots in the rendered schedule."""
    schedule = gpipe_schedule(num_stages, num_microbatches)
    max_cycle = max(c for c, _, _, _ in schedule)
    total_slots = num_stages * (max_cycle + 1)
    used = len(schedule)
    return (total_slots - used) / total_slots


class StageMLP(nn.Module):
    """One stage of a sequential MLP."""

    def __init__(self, in_dim: int, hid_dim: int, out_dim: int):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hid_dim)
        self.fc2 = nn.Linear(hid_dim, out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.relu(self.fc2(torch.relu(self.fc1(x))))


def _pipe_worker(rank: int, world_size: int, init_file: str, iface: str,
                 steps: int, batch: int, microbatches: int, out_queue) -> None:
    """Two-rank pipeline: rank 0 owns stage 0, rank 1 owns stage 1.

    Forward: rank 0 runs stage 0 on microbatch, sends activation to rank 1.
    Rank 1 runs stage 1, computes loss, runs backward, sends grad back to rank 0.
    Rank 0 finishes backward on stage 0. Repeats per microbatch.
    """
    os.environ["GLOO_SOCKET_IFNAME"] = iface
    dist.init_process_group(
        backend="gloo", init_method=f"file://{init_file}",
        rank=rank, world_size=world_size,
    )
    torch.manual_seed(SEED + rank)
    in_dim, hid_dim, mid_dim, out_dim = 16, 32, 16, 4
    if rank == 0:
        stage = StageMLP(in_dim, hid_dim, mid_dim)
    else:
        stage = StageMLP(mid_dim, hid_dim, out_dim)
    optim = torch.optim.SGD(stage.parameters(), lr=0.05)
    loss_fn = nn.MSELoss()
    g = torch.Generator().manual_seed(SEED + 99)
    losses = []
    for step in range(steps):
        optim.zero_grad(set_to_none=True)
        for _ in range(microbatches):
            if rank == 0:
                x = torch.randn(batch, in_dim, generator=g)
                act = stage(x)
                dist.send(act.detach(), dst=1)
                grad = torch.zeros_like(act)
                dist.recv(grad, src=1)
                act.backward(grad)
            else:
                act = torch.zeros(batch, mid_dim, requires_grad=True)
                buf = torch.zeros(batch, mid_dim)
                dist.recv(buf, src=0)
                act = buf.detach().requires_grad_(True)
                pred = stage(act)
                y = torch.zeros(batch, out_dim)
                loss = loss_fn(pred, y)
                loss.backward()
                dist.send(act.grad.detach(), dst=0)
                losses.append(loss.item())
        optim.step()
    norm = sum(p.detach().pow(2).sum().item() for p in stage.parameters()) ** 0.5
    out_queue.put((rank, losses, norm))
    out_queue.close()
    out_queue.join_thread()
    os._exit(0)


def run_pipeline(steps: int = 5, batch: int = 8, microbatches: int = 4) -> dict:
    """Spawn a 2-rank pipeline; return per-rank losses (only rank 1 reports) and norms."""
    ctx = mp.get_context("spawn")
    out_queue = ctx.Queue()
    init_dir = tempfile.mkdtemp(prefix="aie_pipe_")
    init_file = os.path.join(init_dir, "rendezvous")
    iface = _loopback_iface()
    world_size = 2
    procs = []
    try:
        for r in range(world_size):
            p = ctx.Process(
                target=_pipe_worker,
                args=(r, world_size, init_file, iface, steps, batch, microbatches, out_queue),
            )
            p.start()
            procs.append(p)
        results = {}
        for _ in range(world_size):
            rank, losses, norm = out_queue.get(timeout=120)
            results[rank] = (losses, norm)
        return results
    finally:
        for p in procs:
            p.join(timeout=5)
            if p.is_alive():
                p.terminate()
                p.join(timeout=2)
        try:
            os.remove(init_file)
        except FileNotFoundError:
            pass
        try:
            os.rmdir(init_dir)
        except OSError:
            pass


def main() -> int:
    print(f"GPipe schedule analysis: stages={NUM_STAGES}, microbatches={NUM_MICROBATCHES}")
    schedule = gpipe_schedule(NUM_STAGES, NUM_MICROBATCHES)
    print(render_gantt(schedule, NUM_STAGES, NUM_MICROBATCHES))
    closed = bubble_fraction(NUM_STAGES, NUM_MICROBATCHES)
    measured = measure_bubble(NUM_STAGES, NUM_MICROBATCHES)
    print(f"\nclosed-form bubble fraction: {closed * 100:.2f}%")
    print(f"measured bubble fraction:    {measured * 100:.2f}%")
    print("\nbubble vs microbatch count (N=4):")
    print(f"{'M':<6}{'bubble %':<10}")
    for m in (1, 2, 4, 8, 16, 32, 64):
        print(f"{m:<6}{bubble_fraction(4, m)*100:<10.2f}")
    print("\nrunning 2-stage real pipeline over gloo...")
    results = run_pipeline(steps=3, batch=8, microbatches=4)
    rank1_losses = results[1][0]
    print(f"rank 1 saw {len(rank1_losses)} microbatch losses; final norm rank 0 = {results[0][1]:.4f}, rank 1 = {results[1][1]:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
