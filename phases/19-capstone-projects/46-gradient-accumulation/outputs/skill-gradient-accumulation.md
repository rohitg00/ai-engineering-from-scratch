---
name: gradient-accumulation
description: micro-batch loss を scaling し、window ごとに 1 回だけ optimizer step して device memory より大きい effective batch で学習する。
version: 1.0.0
phase: 19
lesson: 46
tags: [training, batch-size, distributed, scaling]
---

## 使う場面

effective batch は gradient を滑らかにし、learning rate schedule と対応させるためのレバーである。1 回の forward pass に入らない場合、この recipe を使う。

## Recipe

1. `micro_batch` は memory に入り accelerator を飽和させる最大値にする。
2. `effective_batch` を schedule から決める。
3. `accum_steps = effective_batch // (micro_batch * world_size)` とし、割り切れることを assert する。
4. micro batch ごとに `loss = criterion(model(x), y) / accum_steps; loss.backward()` を実行する。
5. 非最終 micro では `model.no_sync()` に入り、DDP の gradient all-reduce を抑える。
6. 最後の micro batch 後に `optimizer.step()` を 1 回だけ実行する。次 window の前に gradient を zero にする。
7. optimizer state と learning rate schedule は effective batch ごとに 1 回進む。

## Logging

`effective_batch` ごとに `samples_per_sec`、`median_step_ms`、`sync_calls`、`accum_steps`、`effective_batch` を JSON に出す。これがないと cost trade-off が見えない。

## Failure modes

- `/ accum_steps` を忘れる: gradient が N 倍になる。
- window の途中で step する: parameter が drift する。
- micro batch ごとに sync する: 統計的な利点なしに network bound になる。
- mixed precision unscaling と混ぜる: scaling するのは unscaled loss だけ。
