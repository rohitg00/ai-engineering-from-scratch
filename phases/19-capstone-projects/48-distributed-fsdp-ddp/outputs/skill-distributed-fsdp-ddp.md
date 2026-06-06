---
name: distributed-fsdp-ddp
description: Bring up multi-rank training with a from-scratch DDP wrapper and an FSDP parameter sharding sketch on the gloo or nccl backend.
version: 1.0.0
phase: 19
lesson: 48
tags: [distributed, ddp, fsdp, collectives]
---

## When to use

The model fits on one device but you need more throughput (DDP). The model does not fit on one device (FSDP). Either case: a multi-rank training setup with the same code path.

## Bring up the process group

```python
os.environ["MASTER_ADDR"] = "127.0.0.1"
os.environ["MASTER_PORT"] = str(port)
dist.init_process_group(backend="gloo", rank=rank, world_size=world_size)
```

`gloo` is the CPU backend; `nccl` is the GPU backend. Both implement the same collective surface.

## Wrap the model

1. On rank 0, build the model from your seed.
2. Wrap it with the DDP shell.
3. The shell's `__init__` calls `dist.broadcast(p.data, src=0)` for every parameter and buffer.
4. After every `loss.backward()`, the trainer calls `sync_grads()`.
5. `sync_grads()` calls `dist.all_reduce(p.grad, op=SUM)` and `p.grad.div_(world_size)`.
6. Optimizer step on every rank with the same averaged gradient.

## Shard parameters (FSDP sketch)

1. Flatten each parameter, pad to a multiple of `world_size`.
2. Keep your shard locally; release the rest.
3. Before forward, `dist.all_gather(...)` to rebuild the full tensor on every rank.
4. After forward, drop the full tensor.

## Failure modes

- Skipping the broadcast: ranks start from different inits, diverge silently.
- Forgetting to divide after sum: gradients scaled by world_size, optimizer steps too big.
- Using cross-device rename for checkpoints: not atomic; same lesson 47 trap.
- Mixing CPU and CUDA tensors on the same collective: backend mismatch, run hangs.
