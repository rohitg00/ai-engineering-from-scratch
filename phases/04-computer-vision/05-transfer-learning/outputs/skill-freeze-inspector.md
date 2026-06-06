---
name: skill-freeze-inspector
description: Report which parameters are trainable, which BatchNorm layers are in eval mode, and whether the optimizer is actually consuming the trainable parameters
version: 1.0.0
phase: 4
lesson: 5
tags: [computer-vision, transfer-learning, debugging, pytorch]
---

# Freeze Inspector

Transfer-learning bugs hide in three places: parameters that should be frozen but are not, parameters that should be trainable but are not, and optimizers that were built before the freeze state changed. This skill surfaces all three in one pass.

## When to use

- Right after setting `requires_grad` on a subset of parameters.
- Before the first training step of a fine-tune run.
- After calling `freeze_bn_stats` or any helper that flips BN mode.
- When val accuracy is stuck at random and you suspect nothing is actually training.

## Inputs

- `model`: a PyTorch `nn.Module`.
- `optimizer`: the optimizer about to be used for training.
- Optional `expected_frozen_prefixes`: list of parameter-name prefixes that should be frozen (e.g. `["conv1", "bn1", "layer1"]`).

## Steps

1. **Walk parameters.** For each `(name, param)`:
   - record `requires_grad`
   - record `shape` and `numel`

2. **Walk modules.** For each module:
   - if it is BatchNorm, record whether it is in eval mode and whether its affine parameters are trainable.

3. **Inspect the optimizer.** For each parameter group:
   - flatten its `params` into a set of `id(p)`.
   - compare with the set of all `id(p)` for params where `requires_grad == True`.

4. **Detect the four failure modes:**
   - `leaked_train`: a param has `requires_grad=True` but does not appear in the optimizer (gradient is computed but never applied).
   - `ghost_train`: a param appears in the optimizer but has `requires_grad=False` (optimizer state is wasted; can also cause bugs if you later re-enable requires_grad).
   - `bn_mismatch`: either (a) a BN layer is in train mode (accumulates running stats) while its affine parameters (`weight`, `bias`) are frozen, or (b) a BN layer is in eval mode (frozen stats) while its affine parameters are trainable. Both states are inconsistent and almost always a bug.
   - `expected_vs_actual`: any prefix listed in `expected_frozen_prefixes` still has a trainable parameter.

## Report

```
[freeze-inspector]
  model trainable params: <N>
  model frozen params:    <N>
  batchnorm layers in eval mode: <count>
  batchnorm layers in train mode: <count>

[optimizer coverage]
  trainable params fed to optimizer: <M> of <N>
  leaked_train: <list of names> (trainable but not in optimizer)
  ghost_train:  <list of names> (in optimizer but frozen)

[bn audit]
  mismatched layers: <list of names>

[expectations]
  expected_frozen_prefixes: <...>
  violating params:         <list>

[verdict]
  ok | <one-line summary of the most severe issue>
```

## Rules

- Only report parameter names; never print the weights themselves.
- Sort every list alphabetically by parameter name.
- If optimizer coverage is 100% and there are no mismatches, return `ok` and stop.
- For `leaked_train`, always recommend rebuilding the optimizer after the freeze state changed.
- For `ghost_train`, recommend removing the parameter group or setting `requires_grad=True` if the intent was to train it.
