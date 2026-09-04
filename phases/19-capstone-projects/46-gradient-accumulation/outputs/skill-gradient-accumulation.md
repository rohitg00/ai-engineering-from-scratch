---
name: gradient-accumulation
description: Train at an effective batch larger than device memory by scaling micro-batch losses and stepping the optimizer once per window.
version: 1.0.0
phase: 19
lesson: 46
tags: [training, batch-size, distributed, scaling]
---

## When to use

Effective batch is the lever that smooths the gradient and matches the learning rate schedule. When you cannot afford it in a single forward pass, this is the recipe.

## Recipe

1. Pick `micro_batch` as the largest size that fits in memory and saturates the accelerator.
2. Pick `effective_batch` from the learning rate schedule.
3. Set `accum_steps = effective_batch // (micro_batch * world_size)` and assert it divides evenly.
4. Per micro batch: `loss = criterion(model(x), y) / accum_steps; loss.backward()`.
5. On non-final micros, enter `model.no_sync()` to skip the gradient all-reduce in DDP.
6. After the last micro batch, run `optimizer.step()` once. Zero gradients before the next window.
7. The optimizer state advances once per effective batch; the learning rate schedule ticks once per effective batch.

## Logging

Emit a small JSON record per effective step with `samples_per_sec`, `median_step_ms`, `sync_calls`, `accum_steps`, `effective_batch`. Without this the cost trade is invisible.

## Failure modes

- Forgetting the `/ accum_steps` scaling: gradients explode by N.
- Stepping mid-window: parameters drift.
- Sync on every micro batch: network bound for no statistical gain.
- Mixing this with mixed precision unscaling: scale the unscaled loss only.
