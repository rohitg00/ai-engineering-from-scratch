---
name: distributed-fsdp-ddp
description: gloo または nccl backend で multi-rank training を起動し、from-scratch DDP wrapper と FSDP parameter sharding sketch を使う。
version: 1.0.0
phase: 19
lesson: 48
tags: [distributed, ddp, fsdp, collectives]
---

## 使う場面

model は 1 device に入るが throughput が必要なら DDP。model が 1 device に入らないなら FSDP。どちらも multi-rank training setup であり、基本の code path は同じである。

## Process group を起動する

```python
os.environ["MASTER_ADDR"] = "127.0.0.1"
os.environ["MASTER_PORT"] = str(port)
dist.init_process_group(backend="gloo", rank=rank, world_size=world_size)
```

`gloo` は CPU backend、`nccl` は GPU backend。collective の surface は同じである。

## Model を wrap する

1. rank 0 で seed から model を作る。
2. DDP shell で wrap する。
3. shell の `__init__` は全 parameter と buffer に `dist.broadcast(p.data, src=0)` を呼ぶ。
4. 各 `loss.backward()` 後に trainer が `sync_grads()` を呼ぶ。
5. `sync_grads()` は `dist.all_reduce(p.grad, op=SUM)` と `p.grad.div_(world_size)` を行う。
6. 全 rank が同じ averaged gradient で optimizer step する。

## Parameter を shard する (FSDP sketch)

1. 各 parameter を flatten し、`world_size` の倍数まで pad する。
2. local shard だけを保持し、残りは解放する。
3. forward 前に `dist.all_gather(...)` で full tensor を全 rank に復元する。
4. forward 後に full tensor を捨てる。

## Failure modes

- broadcast を省く: rank が別 init から始まり静かに diverge する。
- sum 後に割り忘れる: gradient が `world_size` 倍になり step が大きすぎる。
- checkpoint で cross-device rename を使う: atomic ではない。
- CPU tensor と CUDA tensor を同じ collective に混ぜる: backend mismatch で hang する。
