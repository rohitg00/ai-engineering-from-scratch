---
name: checkpoint-save-resume
description: 完全な RNG capture を含む atomic/sharded checkpoint により、kill された run を mid-epoch から同じ loss trajectory で再開する。
version: 1.0.0
phase: 19
lesson: 47
tags: [training, durability, resume, sharded-state]
---

## 使う場面

cluster の wallclock 上限を超える training run、node reboot に耐える必要がある run、単一 payload に収まらない大きな model で使う。

## Payload shape

```python
{
  "schema": "ckpt.v1",
  "model": model.state_dict(),
  "optimizer": opt.state_dict(),
  "scheduler": sched.state_dict(),
  "state": {"step": int, "epoch": int, "batch_in_epoch": int, "losses": [float, ...]},
  "rng": {"python": ..., "numpy": ..., "torch_cpu": ..., "torch_cuda": ...},
  "wall_saved_at": time.time(),
}
```

## Atomic save

1. target と同じ directory に unique temp file を作り payload を書く。
2. `os.replace(tmp, target)` で atomic に入れ替える。
3. target name へ直接書かない。

## Sharded layout

- `model.shard-NNN.pt` は shard ごとの tensor payload。
- `meta.pt` は optimizer、scheduler、train state、RNG、shard manifest を持つ。
- `index.json` は各 shard と `meta.pt` の `sha256` を持つ。
- loader は merge 前に全 hash を検証する。

## Mid-epoch resume

- `step` の横に `(epoch, batch_in_epoch)` を保存する。
- resumed epoch の最初の batch 前に RNG state を復元する。
- 既に消費した batch 分 generator を fast-forward する。

## Failure modes

- cross-device rename: atomic ではない。temp は同じ directory に置く。
- RNG 忘れ: resumed loss が baseline から diverge する。
- optimizer state 忘れ: 次 step が大きくずれる。
- checkpoint pruning の誤り: last K と best を残す。
